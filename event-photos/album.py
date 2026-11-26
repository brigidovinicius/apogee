import fcntl
import hashlib
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
MAX_PHOTOS = 400
SCHEMA = """
CREATE TABLE IF NOT EXISTS album (
    id TEXT PRIMARY KEY, expires INTEGER NOT NULL, authorization TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS photo (
    id TEXT PRIMARY KEY, digest TEXT NOT NULL, event TEXT NOT NULL REFERENCES album(id),
    name TEXT NOT NULL, model TEXT NOT NULL, state TEXT NOT NULL, error TEXT,
    UNIQUE(event, digest)
);
CREATE TABLE IF NOT EXISTS face (
    photo TEXT NOT NULL REFERENCES photo(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL, embedding BLOB NOT NULL CHECK(length(embedding) = 512),
    PRIMARY KEY (photo, ordinal)
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
    if not EVENT_RE.fullmatch(event) or expires <= time.time() or not authorization.strip():
        raise ValueError("Informe evento, prazo futuro e referência da autorização ou dados sintéticos")
    with writer(), connect() as db:
        db.executescript(SCHEMA)
        db.execute("INSERT INTO album VALUES (?, ?, ?)", (event, expires, authorization))


def active(db, event):
    return db.execute("SELECT expires FROM album WHERE id=? AND expires>?", (event, time.time())).fetchone()


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


def import_batch(event, source, vision):
    source = source.resolve(strict=True)
    if not source.is_dir() or source == ROOT or ROOT in source.parents or source in ROOT.parents:
        raise ValueError("O lote deve ficar em diretório separado de ALBUM_DATA")
    counters = dict(ready=0, faces=0, skipped=0, errors=0)
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
                if row and (row["state"] == "deleted" or (row["state"] == "ready" and row["model"] == MODEL)):
                    counters["skipped"] += 1
                    continue
                if not row and db.execute("SELECT count(*) FROM photo WHERE event=?", (event,)).fetchone()[0] >= MAX_PHOTOS:
                    raise ValueError(f"Limite de {MAX_PHOTOS} registros no álbum piloto")
                photo_id = row["id"] if row else uuid4().hex
                if row:
                    db.execute("UPDATE photo SET model=?, state='pending', error=NULL WHERE id=?", (MODEL, photo_id))
                    db.execute("DELETE FROM face WHERE photo=?", (photo_id,))
                else:
                    db.execute("INSERT INTO photo VALUES (?, ?, ?, ?, ?, 'pending', NULL)",
                               (photo_id, digest, event, path.name, MODEL))
            try:
                image = decode(data, ["JPEG"])
                vectors = vision.features(image)
                original, thumbnail = paths(photo_id)
                image.thumbnail((640, 640))
                atomic_file(original, lambda file: file.write(data))
                atomic_file(thumbnail, lambda file: image.save(file, "JPEG", quality=82))
                with connect() as db:
                    db.executemany("INSERT INTO face VALUES (?, ?, ?)",
                                   [(photo_id, i, vec.tobytes()) for i, vec in enumerate(vectors)])
                    db.execute("UPDATE photo SET state='ready' WHERE id=?", (photo_id,))
                counters["ready"] += 1
                counters["faces"] += len(vectors)
                print(json.dumps({"id": photo_id, "file": path.name, "state": "ready",
                                  "faces": len(vectors), "seconds": round(time.perf_counter() - started, 3)}))
            except (InvalidImage, OSError, cv2.error) as error:
                reason = str(error) if isinstance(error, InvalidImage) else "processing_failed"
                with connect() as db:
                    db.execute("UPDATE photo SET state='error', error=? WHERE id=?", (reason, photo_id))
                counters["errors"] += 1
                print(json.dumps({"id": photo_id, "file": path.name, "state": "error", "error": reason}), file=sys.stderr)
    return counters


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
    db.execute("DELETE FROM face WHERE photo=?", (photo_id,))


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
            albums = db.execute("SELECT id FROM album WHERE expires<=?", (time.time(),)).fetchall()
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
