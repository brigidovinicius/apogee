import fcntl
import hashlib
import hmac
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from contextlib import closing, contextmanager
from pathlib import Path
from uuid import uuid4

import cv2

from vision import MAX_ORIGINAL, MODEL, InvalidImage, decode

ROOT = Path(os.getenv("ALBUM_DATA", "data")).resolve()
EVENT_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,79}")
PHOTO_RE = re.compile(r"[a-f0-9]{32}")
MEMBER_RE = re.compile(r"[a-zA-Z0-9_-]{1,128}")
GALLERY_VERSION = "gallery-v1"
CONSENT_VERSION = "opt-in-v1"
CONSENT_SECONDS = 30 * 24 * 60 * 60
MAX_PHOTOS = 400
SCHEMA = """
CREATE TABLE IF NOT EXISTS album (
    id TEXT PRIMARY KEY, expires INTEGER, authorization TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS photo (
    id TEXT PRIMARY KEY, digest TEXT NOT NULL, event TEXT NOT NULL REFERENCES album(id),
    name TEXT NOT NULL, model TEXT NOT NULL, state TEXT NOT NULL, error TEXT,
    UNIQUE(event, digest)
);
CREATE TABLE IF NOT EXISTS opt_in (
    event TEXT NOT NULL REFERENCES album(id) ON DELETE CASCADE,
    actor TEXT NOT NULL, member_id TEXT NOT NULL, version TEXT NOT NULL, granted_at INTEGER NOT NULL, expires INTEGER NOT NULL,
    PRIMARY KEY(event, actor)
);
CREATE TABLE IF NOT EXISTS opt_in_face (
    event TEXT NOT NULL, actor TEXT NOT NULL,
    photo TEXT NOT NULL REFERENCES photo(id) ON DELETE CASCADE,
    model TEXT NOT NULL, embedding BLOB NOT NULL CHECK(length(embedding) = 512),
    PRIMARY KEY(event, actor, photo),
    FOREIGN KEY(event, actor) REFERENCES opt_in(event, actor) ON DELETE CASCADE
);
"""


@contextmanager
def connect():
    with closing(sqlite3.connect(ROOT / "album.sqlite3", timeout=5)) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        db.execute("PRAGMA secure_delete = ON")
        with db:
            yield db


@contextmanager
def writer():
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if ROOT.stat().st_mode & 0o077:
        raise ValueError("O diretório ALBUM_DATA deve ter permissão 0700")
    with (ROOT / ".writer.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


@contextmanager
def search_guard():
    with (ROOT / ".writer.lock").open("rb") as lock:
        fcntl.flock(lock, fcntl.LOCK_SH | fcntl.LOCK_NB)
        yield


def start(event, expires, authorization):
    if not EVENT_RE.fullmatch(event) or (expires is not None and expires <= time.time()) or not authorization.strip():
        raise ValueError("Informe evento, prazo válido e referência da autorização ou dados sintéticos")
    with writer(), connect() as db:
        db.executescript(SCHEMA)
        db.execute("INSERT INTO album VALUES (?, ?, ?)", (event, expires, authorization))


def active(db, event):
    return db.execute("SELECT expires FROM album WHERE id=? AND (expires IS NULL OR expires>?)", (event, time.time())).fetchone()


def paths(photo_id):
    return ROOT / f"{photo_id}.jpg", ROOT / f"{photo_id}.thumb.jpg"


def atomic_file(path, save):
    temporary = path.with_suffix(".tmp")
    try:
        with temporary.open("wb") as destination:
            save(destination)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def import_batch(event, source):
    source = source.resolve(strict=True)
    if not source.is_dir() or source == ROOT or ROOT in source.parents or source in ROOT.parents:
        raise ValueError("O lote deve ficar em diretório separado de ALBUM_DATA")
    counters = dict(ready=0, skipped=0, errors=0)
    with writer():
        with connect() as db:
            if not active(db, event):
                raise ValueError("Álbum inexistente ou vencido")
        for path in sorted(source.iterdir()):
            if path.suffix.lower() not in {".jpg", ".jpeg"} or path.is_symlink() or not path.is_file():
                continue
            started = time.perf_counter()
            with path.open("rb") as original:
                data = original.read(MAX_ORIGINAL + 1)
            if not data or len(data) > MAX_ORIGINAL:
                counters["errors"] += 1
                print(json.dumps({"file": path.name, "state": "error", "error": "invalid_size"}), file=sys.stderr)
                continue
            digest = hashlib.sha256(data).hexdigest()
            with connect() as db:
                if not active(db, event):
                    raise ValueError("Álbum inexistente ou vencido")
                row = db.execute("SELECT id, state, model FROM photo WHERE event=? AND digest=?", (event, digest)).fetchone()
                if row and (row["state"] == "deleted" or (row["state"] == "ready" and row["model"] == GALLERY_VERSION)):
                    counters["skipped"] += 1
                    continue
                if not row and db.execute("SELECT count(*) FROM photo WHERE event=?", (event,)).fetchone()[0] >= MAX_PHOTOS:
                    raise ValueError(f"Limite de {MAX_PHOTOS} registros no álbum piloto")
                photo_id = row["id"] if row else uuid4().hex
                if row:
                    db.execute("UPDATE photo SET model=?, state='pending', error=NULL WHERE id=?", (GALLERY_VERSION, photo_id))
                else:
                    db.execute("INSERT INTO photo VALUES (?, ?, ?, ?, ?, 'pending', NULL)",
                               (photo_id, digest, event, path.name, GALLERY_VERSION))
            try:
                image = decode(data, ["JPEG"])
                original, thumbnail = paths(photo_id)
                image.thumbnail((640, 640))
                atomic_file(original, lambda file: file.write(data))
                atomic_file(thumbnail, lambda file: image.save(file, "JPEG", quality=82))
                with connect() as db:
                    db.execute("UPDATE photo SET state='ready' WHERE id=?", (photo_id,))
                counters["ready"] += 1
                print(json.dumps({"id": photo_id, "file": path.name, "state": "ready",
                                  "seconds": round(time.perf_counter() - started, 3)}))
            except (InvalidImage, OSError, cv2.error) as error:
                reason = str(error) if isinstance(error, InvalidImage) else "processing_failed"
                with connect() as db:
                    db.execute("UPDATE photo SET state='error', error=? WHERE id=?", (reason, photo_id))
                counters["errors"] += 1
                print(json.dumps({"id": photo_id, "file": path.name, "state": "error", "error": reason}), file=sys.stderr)
    return counters


def consent_state(db, event, actor, photo_id=None):
    row = db.execute(
        "SELECT version FROM opt_in WHERE event=? AND actor=? AND expires>?", (event, actor, time.time()),
    ).fetchone()
    granted = bool(row and row["version"] == CONSENT_VERSION)
    indexed = granted and db.execute("""
        SELECT 1 FROM opt_in_face f JOIN photo p ON p.id=f.photo
        WHERE f.event=? AND f.actor=? AND f.model=? AND p.state='ready'
          AND (? IS NULL OR f.photo=?) LIMIT 1
    """, (event, actor, MODEL, photo_id, photo_id)).fetchone() is not None
    return {"granted": granted, "indexed": indexed}


def change_consent(event, actor, granted, member_id=None):
    with writer(), connect() as db:
        if not active(db, event):
            return False
        if granted:
            version = db.execute("SELECT version FROM opt_in WHERE event=? AND actor=? AND expires>?",
                                 (event, actor, time.time())).fetchone()
            if not version or version["version"] != CONSENT_VERSION:
                db.execute("DELETE FROM opt_in WHERE event=? AND actor=?", (event, actor))
                now = int(time.time())
                db.execute("INSERT INTO opt_in VALUES (?, ?, ?, ?, ?, ?)",
                           (event, actor, member_id, CONSENT_VERSION, now, now + CONSENT_SECONDS))
        else:
            db.execute("DELETE FROM opt_in WHERE event=? AND actor=?", (event, actor))
        return True


def actor_key(secret, event, member_id):
    proof = json.dumps(["actor", event, member_id], ensure_ascii=False, separators=(",", ":"))
    return hmac.new(secret.encode(), proof.encode(), "sha256").hexdigest()


def index_opt_in(event, member_id, photo_id, box, vision, secret):
    actor = actor_key(secret, event, member_id)
    left, top, right, bottom = box
    if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1) or not PHOTO_RE.fullmatch(photo_id):
        raise ValueError("Informe a foto e os quatro limites normalizados do recorte")
    with writer(), connect() as db:
        if not active(db, event) or not consent_state(db, event, actor)["granted"]:
            raise ValueError("O participante precisa autorizar a busca antes da indexação")
        photo = db.execute("SELECT 1 FROM photo WHERE id=? AND event=? AND state='ready'",
                           (photo_id, event)).fetchone()
        if not photo:
            raise ValueError("Foto indisponível no evento")
        image = decode(paths(photo_id)[0].read_bytes(), ["JPEG"])
        crop = image.crop((round(left*image.width), round(top*image.height),
                           round(right*image.width), round(bottom*image.height)))
        if min(crop.size) < 32:
            raise ValueError("O recorte precisa ter pelo menos 32 pixels por lado na resolução de análise")
        vectors = vision.features(crop, selfie=True)
        if not vectors:
            raise ValueError("Nenhum rosto no recorte autorizado")
        db.execute("""
            INSERT INTO opt_in_face VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(event, actor, photo) DO UPDATE SET
                model=excluded.model, embedding=excluded.embedding
        """, (event, actor, photo_id, MODEL, vectors[0].tobytes()))


def video_path(event):
    if not EVENT_RE.fullmatch(event):
        raise ValueError("Evento inválido")
    return ROOT / f"{event}.mp4"


def import_video(event, source):
    maximum = 1024**3
    with writer(), connect() as db, source.open("rb") as file:
        if not active(db, event):
            raise ValueError("Álbum inexistente ou vencido")
        if os.fstat(file.fileno()).st_size > maximum or file.read(8)[4:] != b"ftyp":
            raise ValueError("Use um vídeo MP4 de até 1 GiB")
        file.seek(0)

        def copy(destination):
            shutil.copyfileobj(file, destination, 256 * 1024)
            if destination.tell() > maximum:
                raise ValueError("Use um vídeo MP4 de até 1 GiB")

        atomic_file(video_path(event), copy)


def delete_video(event):
    with writer():
        path = video_path(event)
        path.unlink(missing_ok=True)
        path.with_suffix(".tmp").unlink(missing_ok=True)


def remove_photo(db, photo_id):
    db.execute("UPDATE photo SET state='deleted', name='', error=NULL WHERE id=?", (photo_id,))
    db.execute("DELETE FROM opt_in_face WHERE photo=?", (photo_id,))


def delete(event, photo_id):
    if not PHOTO_RE.fullmatch(photo_id):
        raise ValueError("ID de foto inválido")
    with writer():
        with connect() as db:
            if not db.execute("SELECT 1 FROM photo WHERE event=? AND id=?", (event, photo_id)).fetchone():
                raise ValueError("Foto ausente neste álbum")
            remove_photo(db, photo_id)
        for path in paths(photo_id):
            path.unlink(missing_ok=True)
            path.with_suffix(".tmp").unlink(missing_ok=True)


def purge(event=None):
    with writer():
        with connect() as db:
            if event is not None:
                db.execute("UPDATE album SET expires=0 WHERE id=?", (event,))
            now = time.time()
            db.execute("DELETE FROM opt_in WHERE expires<=?", (now,))
            albums = db.execute("SELECT id FROM album WHERE expires<=?", (now,)).fetchall()
        for (album_id,) in albums:
            video = video_path(album_id)
            video.unlink(missing_ok=True)
            video.with_suffix(".tmp").unlink(missing_ok=True)
            with connect() as db:
                photos = db.execute("SELECT id FROM photo WHERE event=?", (album_id,)).fetchall()
                for (photo_id,) in photos:
                    remove_photo(db, photo_id)
            for (photo_id,) in photos:
                for path in paths(photo_id):
                    path.unlink(missing_ok=True)
                    path.with_suffix(".tmp").unlink(missing_ok=True)
            with connect() as db:
                db.execute("DELETE FROM photo WHERE event=?", (album_id,))
                db.execute("DELETE FROM album WHERE id=?", (album_id,))
