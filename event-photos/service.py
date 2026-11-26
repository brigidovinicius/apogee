import hmac
import json
import os
import re
import sqlite3
import threading
import time
from wsgiref.util import FileWrapper

import cv2
import numpy as np

from album import EVENT_RE, PHOTO_RE, active, connect, paths, purge, search_guard, video_path
from vision import MAX_SELFIE, MODEL, THRESHOLD, InvalidImage, Vision, decode

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
            if method == "POST" and route == ["search"]:
                return self.search(db, event, env, respond)
        return result(respond, "404 Not Found", {"error": "not_found"})

    def media(self, db, event, photo_id, variant, respond, env):
        if variant in {"thumb", "download"} and db.execute(
            "SELECT 1 FROM photo WHERE id=? AND event=? AND state='ready'", (photo_id, event)
        ).fetchone():
            return send_file(paths(photo_id)[variant == "thumb"], "image/jpeg", respond, env)
        return result(respond, "404 Not Found", {"error": "not_found"})

    def search(self, db, event, env, respond):
        if not db.execute("SELECT 1 FROM photo WHERE event=? AND state='ready' AND model=? LIMIT 1",
                          (event, MODEL)).fetchone():
            return result(respond, "409 Conflict", {"error": "not_indexed"})
        actor = env.get("HTTP_X_ALBUM_ACTOR", "")
        if env.get("HTTP_X_ALBUM_CONSENT") != "selfie-v1" or not re.fullmatch(r"[a-f0-9]{64}", actor):
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
                return self.compare(db, event, env, respond, actor, raw_size, formats)
        except BlockingIOError:
            return result(respond, "429 Too Many Requests", {"error": "busy"})
        finally:
            self.search_slot.release()


    def compare(self, db, event, env, respond, actor, raw_size, formats):
        window = int(time.monotonic() // 60)
        self.attempts = {key: val for key, val in self.attempts.items() if key[1] == window}
        key = (actor, window)
        if len(self.attempts) >= 5000 or self.attempts.get(key, 0) >= 6:
            return result(respond, "429 Too Many Requests", {"error": "rate_limit"})
        self.attempts[key] = self.attempts.get(key, 0) + 1
        length = int(raw_size)
        data = env["wsgi.input"].read(length)
        if len(data) != length:
            return result(respond, "400 Bad Request", {"error": "invalid_image"})
        try:
            vectors = self.vision.features(decode(data, formats, max_pixels=16_000_000), selfie=True)
        except InvalidImage as error:
            return result(respond, "422 Unprocessable Content", {"error": str(error)})
        if not vectors:
            return result(respond, "422 Unprocessable Content", {"error": "no_face"})
        rows = db.execute("""
            SELECT photo.id, face.embedding FROM face JOIN photo ON photo.id=face.photo
            WHERE photo.event=? AND photo.state='ready' AND photo.model=?
        """, (event, MODEL))
        scores = {}
        for photo_id, embedding in rows:
            score = float(vectors[0] @ np.frombuffer(embedding, dtype="<f4"))
            if score >= THRESHOLD:
                scores[photo_id] = max(score, scores.get(photo_id, -1))
        if not active(db, event):
            return result(respond, "404 Not Found", {"error": "not_found"})
        ids = sorted(scores, key=lambda photo_id: (-scores[photo_id], photo_id))
        return result(respond, "200 OK", {"ids": ids})


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
    with connect() as db:
        db.execute("SELECT 1 FROM album LIMIT 1").fetchone()
    app = Service(os.environ["ALBUM_SECRET"], Vision())
    threading.Thread(target=janitor, daemon=True).start()
    return app
