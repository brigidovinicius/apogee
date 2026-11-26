import hmac
import json
import os
import re
import sqlite3
import threading
import time
from wsgiref.util import FileWrapper

import cv2

from album import (
    CONSENT_VERSION, EVENT_RE, MEMBER_RE, PHOTO_RE, active, actor_key, change_consent, connect, consent_state,
    paths, purge, region_crop, search_guard, upgrade, video_path,
)
from vision import MAX_SELFIE, THRESHOLD, InvalidImage, Vision, decode

MAX_SEARCH_SECONDS = 80
PHOTO_QUERY = """
    SELECT id FROM photo
    WHERE event=? AND state='ready'
    ORDER BY rowid
"""


class Service:
    def __init__(self, secret, vision):
        if len(secret) < 32 or not secret.isascii():
            raise ValueError("ALBUM_SECRET precisa de pelo menos 32 caracteres ASCII")
        self.secret = secret
        self.vision = vision
        self.search_slot = threading.Lock()
        self.attempts = {}

    def __call__(self, env, respond):
        try:
            return self.route(env, respond)
        except (OSError, sqlite3.Error, cv2.error, InvalidImage):
            return result(respond, "503 Service Unavailable", {"error": "unavailable"})

    def route(self, env, respond):
        if not hmac.compare_digest(env.get("HTTP_AUTHORIZATION", "").encode(), f"Bearer {self.secret}".encode()):
            return result(respond, "401 Unauthorized", {"error": "unauthorized"})
        event, *route = env["PATH_INFO"].strip("/").split("/")
        if not EVENT_RE.fullmatch(event):
            return result(respond, "404 Not Found", {"error": "not_found"})
        method = env["REQUEST_METHOD"]
        with connect() as db:
            album = active(db, event)
            if not album:
                return result(respond, "404 Not Found", {"error": "not_found"})
            if method == "GET" and route == ["photos"]:
                ids = [row["id"] for row in db.execute(PHOTO_QUERY, (event,))]
                return result(respond, "200 OK", {"ids": ids, "expires": album["expires"], "video": video_path(event).is_file()})
            if method == "GET" and route == ["video"]:
                return send_file(video_path(event), "video/mp4", respond, env)
            if method == "GET" and len(route) == 2 and PHOTO_RE.fullmatch(route[0]):
                return self.media(db, event, route[0], route[1], respond, env)
            if self.vision and route == ["consent"]:
                return self.consent(db, event, env, respond, method)
            if method == "GET" and route[:1] == ["saved"] and (
                len(route) == 1 or (len(route) == 2 and PHOTO_RE.fullmatch(route[1]))
            ):
                return self.saved(db, event, env, respond, *route[1:])
            if self.vision and method == "POST" and route in (["search"], ["validate"]):
                return self.search(db, event, env, respond, validate_only=route == ["validate"])
        return result(respond, "404 Not Found", {"error": "not_found"})

    def media(self, db, event, photo_id, variant, respond, env):
        if variant in {"thumb", "download"} and db.execute(
            "SELECT 1 FROM photo WHERE id=? AND event=? AND state='ready'", (photo_id, event)
        ).fetchone():
            return send_file(paths(photo_id)[variant == "thumb"], "image/jpeg", respond, env)
        return result(respond, "404 Not Found", {"error": "not_found"})

    def saved(self, db, event, env, respond, photo_id=None):
        member = self.member(event, env)
        if not member:
            return result(respond, "400 Bad Request", {"error": "forbidden"})
        rows = db.execute("""
            SELECT s.photo FROM saved_photo s JOIN photo p ON p.id=s.photo AND p.event=s.event
            WHERE s.event=? AND s.member_id=? AND p.state='ready' AND (? IS NULL OR s.photo=?)
            ORDER BY s.saved_at DESC, p.rowid
        """, (event, member, photo_id, photo_id))
        ids = [row["photo"] for row in rows]
        if photo_id and not ids:
            return result(respond, "404 Not Found", {"error": "not_found"})
        return result(respond, "200 OK", {"ids": ids})

    def member(self, event, env):
        member = env.get("HTTP_X_ALBUM_MEMBER", "")
        if MEMBER_RE.fullmatch(member) and hmac.compare_digest(
            env.get("HTTP_X_ALBUM_ACTOR", "").encode(), actor_key(self.secret, event, member).encode()
        ):
            return member
        return None

    def consent(self, db, event, env, respond, method):
        actor = env.get("HTTP_X_ALBUM_ACTOR", "")
        if not re.fullmatch(r"[a-f0-9]{64}", actor):
            return result(respond, "400 Bad Request", {"error": "forbidden"})
        if method == "GET":
            return result(respond, "200 OK", consent_state(db, event, actor))
        if method in {"POST", "DELETE"}:
            member_id = env.get("HTTP_X_ALBUM_MEMBER", "")
            if method == "POST" and (
                env.get("HTTP_X_ALBUM_CONSENT") != CONSENT_VERSION or not MEMBER_RE.fullmatch(member_id)
                or not hmac.compare_digest(actor, actor_key(self.secret, event, member_id))
            ):
                return result(respond, "400 Bad Request", {"error": "consent_required"})
            try:
                if not change_consent(event, actor, method == "POST", member_id):
                    return result(respond, "404 Not Found", {"error": "not_found"})
            except BlockingIOError:
                return result(respond, "429 Too Many Requests", {"error": "busy"})
            return result(respond, "200 OK", consent_state(db, event, actor))
        return result(respond, "404 Not Found", {"error": "not_found"})

    def search(self, db, event, env, respond, validate_only=False):
        actor = env.get("HTTP_X_ALBUM_ACTOR", "")
        member = self.member(event, env)
        if not member or env.get("HTTP_X_ALBUM_CONSENT") != "selfie-v1":
            return result(respond, "400 Bad Request", {"error": "consent_required"})
        raw_size = env.get("CONTENT_LENGTH", "")
        if not re.fullmatch(r"\d{1,8}", raw_size) or not 0 < int(raw_size) <= MAX_SELFIE:
            return result(respond, "413 Payload Too Large", {"error": "invalid_size"})
        formats = {"image/jpeg": ["JPEG"], "image/png": ["PNG"]}.get(env.get("CONTENT_TYPE"))
        if formats is None:
            return result(respond, "415 Unsupported Media Type", {"error": "invalid_format"})
        if not self.search_slot.acquire(blocking=False):
            return result(respond, "429 Too Many Requests", {"error": "busy"})
        try:
            with search_guard():
                state = consent_state(db, event, actor)
                if not state["granted"]:
                    return result(respond, "400 Bad Request", {"error": "consent_required"})
                if not validate_only and not state["indexed"]:
                    return result(respond, "409 Conflict", {"error": "not_enrolled"})
                return self.compare(db, event, env, respond, actor, member, int(raw_size), formats, validate_only)
        except BlockingIOError:
            return result(respond, "429 Too Many Requests", {"error": "busy"})
        finally:
            self.search_slot.release()


    def query_vector(self, stream, length, formats):
        data = bytearray(stream.read(length))
        try:
            if len(data) != length:
                raise InvalidImage("invalid_image")
            with decode(data, formats, max_pixels=16_000_000) as image:
                vectors = self.vision.features(image, selfie=True)
            if not vectors:
                raise InvalidImage("no_face")
            return vectors[0]
        finally:
            data[:] = bytes(len(data))

    def compare(self, db, event, env, respond, actor, member, length, formats, validate_only):
        window = int(time.monotonic() // 60)
        self.attempts = {key: val for key, val in self.attempts.items() if key[1] == window}
        key = (actor, window)
        if len(self.attempts) >= 5000 or self.attempts.get(key, 0) >= 6:
            return result(respond, "429 Too Many Requests", {"error": "rate_limit"})
        self.attempts[key] = self.attempts.get(key, 0) + 1
        deadline = time.monotonic() + MAX_SEARCH_SECONDS
        try:
            query = self.query_vector(env["wsgi.input"], length, formats)
        except InvalidImage as error:
            return result(respond, "422 Unprocessable Content", {"error": str(error)})
        try:
            if validate_only:
                return result(respond, "200 OK", {"validated": True})
            scores = self.match_regions(db, event, actor, query, deadline)
        except TimeoutError:
            return result(respond, "503 Service Unavailable", {"error": "search_timeout"})
        finally:
            query.fill(0)
        if not active(db, event) or not consent_state(db, event, actor)["granted"]:
            return result(respond, "404 Not Found", {"error": "not_found"})
        ids = sorted(scores, key=lambda photo_id: (-scores[photo_id], photo_id))
        now = int(time.time())
        db.executemany(
            "INSERT OR IGNORE INTO saved_photo VALUES (?, ?, ?, ?)",
            [(event, member, photo_id, now) for photo_id in ids],
        )
        db.commit()
        return result(respond, "200 OK", {"ids": ids})

    def match_regions(self, db, event, actor, query, deadline):
        rows = db.execute("""
            SELECT r.photo, r.left, r.top, r.right, r.bottom
            FROM opt_in_region r JOIN photo p ON p.id=r.photo AND p.event=r.event
            WHERE r.event=? AND r.actor=? AND p.state='ready'
        """, (event, actor))
        scores = {}
        for photo_id, *box in rows:
            if time.monotonic() >= deadline:
                raise TimeoutError()
            try:
                with region_crop(photo_id, box) as crop:
                    if min(crop.size) < 32:
                        continue
                    candidates = self.vision.features(crop, selfie=True)
            except (InvalidImage, FileNotFoundError):
                continue
            for candidate in candidates:
                try:
                    score = float(query @ candidate)
                    if score >= THRESHOLD:
                        scores[photo_id] = score
                finally:
                    candidate.fill(0)
        if time.monotonic() >= deadline:
            raise TimeoutError()
        return scores


def send_file(path, content_type, respond, env):
    try:
        file = path.open("rb")
    except FileNotFoundError:
        return result(respond, "404 Not Found", {"error": "not_found"})
    headers = [("Content-Type", content_type), ("Content-Length", str(os.fstat(file.fileno()).st_size))]
    respond("200 OK", private_headers() + headers)
    return env.get("wsgi.file_wrapper", FileWrapper)(file, 64 * 1024)


def private_headers():
    return [("Cache-Control", "private, no-store"), ("X-Content-Type-Options", "nosniff")]


def result(respond, status, payload):
    data = json.dumps(payload).encode()
    respond(status, private_headers() + [("Content-Type", "application/json"), ("Content-Length", str(len(data)))])
    return [data]


def janitor():
    while True:
        try:
            purge()
        except (OSError, ValueError, sqlite3.Error):
            # A importação pode estar com a trava. A expiração bloqueia o acesso de imediato.
            pass
        time.sleep(60)


def create_app():
    upgrade()
    app = Service(os.environ["ALBUM_SECRET"], Vision() if os.getenv("ALBUM_SELFIE_ENABLED") == "true" else None)
    threading.Thread(target=janitor, daemon=True).start()
    return app
