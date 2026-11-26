import hashlib
import hmac
import io
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

import album
from service import Service
from vision import InvalidImage


def fixture(color):
    data = io.BytesIO()
    Image.new("RGB", (64, 64), color).save(data, "JPEG")
    return data.getvalue()


class FixtureVision:
    def features(self, image, selfie=False):
        red, green, blue = image.getpixel((0, 0))
        if max(red, green, blue) < 10:
            return []
        match = np.eye(1, 128, 0, dtype="<f4")[0]
        different = np.eye(1, 128, 1, dtype="<f4")[0]
        if green > 100:
            if selfie:
                raise InvalidImage("multiple_faces")
            return [match, match]
        return [match if red > blue else different]


class AlbumTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        self.source = root / "input"
        self.source.mkdir()
        self.private = root / "private"
        patcher = patch.object(album, "ROOT", self.private)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.vision = FixtureVision()
        self.service = Service("x" * 32, self.vision)
        for event in ("workshop", "otro-evento"):
            album.start(event, int(time.time()) + 1000, "synthetic-test")

    def actor(self, event="workshop", member="fixture"):
        proof = json.dumps(["actor", event, member], separators=(",", ":"))
        return hmac.new(b"x" * 32, proof.encode(), hashlib.sha256).hexdigest()

    def request(self, path, body=None, **headers):
        captured = {}
        env = {
            "PATH_INFO": path, "REQUEST_METHOD": "GET" if body is None else "POST",
            "HTTP_AUTHORIZATION": "Bearer " + "x" * 32, "HTTP_X_ALBUM_ACTOR": self.actor(), "HTTP_X_ALBUM_MEMBER": "fixture",
            "HTTP_X_ALBUM_CONSENT": "selfie-v1", "CONTENT_LENGTH": str(len(body or b"")),
            "CONTENT_TYPE": "image/jpeg", "wsgi.input": io.BytesIO(body or b""), **headers,
        }

        def respond(status, fields):
            captured["status"] = int(status.split()[0])
            captured["headers"] = dict(fields)

        result = self.service(env, respond)
        try:
            data = b"".join(result)
        finally:
            if hasattr(result, "close"):
                result.close()
        self.assertEqual(captured["headers"]["Cache-Control"], "private, no-store")
        if captured["headers"]["Content-Type"] == "application/json":
            data = json.loads(data)
        return captured["status"], data

    def seed(self):
        group = Image.new("RGB", (128, 64), "blue")
        group.paste("red", (0, 0, 64, 64))
        group.save(self.source / "group.jpg")
        (self.source / "other.jpg").write_bytes(fixture("blue"))
        (self.source / "broken.jpg").write_bytes(b"broken-image")
        return album.import_batch("workshop", self.source)

    def enroll(self, member="fixture"):
        with album.connect() as db:
            photo_id = db.execute("SELECT id FROM photo WHERE name='group.jpg'").fetchone()[0]
        actor = self.actor(member=member)
        self.assertEqual(self.request("/workshop/consent", b"", HTTP_X_ALBUM_ACTOR=actor, HTTP_X_ALBUM_MEMBER=member,
                                      HTTP_X_ALBUM_CONSENT=album.CONSENT_VERSION),
                         (200, {"granted": True, "indexed": False}))
        album.index_opt_in("workshop", member, photo_id, (0, 0, .5, 1), "x" * 32)
        return photo_id

    def test_resume_deduplication_and_original(self):
        self.assertEqual(self.seed(), {"ready": 2, "skipped": 0, "errors": 1})
        with album.connect() as db:
            db.execute("UPDATE photo SET state='pending' WHERE name='group.jpg'")
        self.assertEqual(album.import_batch("workshop", self.source),
                         {"ready": 1, "skipped": 1, "errors": 1})
        _, response = self.request("/workshop/photos")
        self.assertEqual(len(response["ids"]), 2)
        with album.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM opt_in_region").fetchone()[0], 0)
        self.assertEqual(self.request("/workshop/search", fixture("red"))[1]["error"], "consent_required")
        self.enroll()
        status, results = self.request("/workshop/search", fixture("red"))
        self.assertEqual(status, 200)
        self.assertEqual(len(results["ids"]), 1)
        photo_id = results["ids"][0]
        self.assertEqual(self.request(f"/workshop/{photo_id}/download"),
                         (200, (self.source / "group.jpg").read_bytes()))
        self.assertEqual(self.request(f"/otro-evento/{photo_id}/thumb")[0], 404)
        self.assertEqual(self.request("/otro-evento/search", fixture("red"))[0], 400)
        self.assertEqual(self.request("/workshop/photos", HTTP_AUTHORIZATION="")[0], 401)

    def test_errors_and_purge(self):
        self.seed()
        self.enroll()
        self.assertEqual(self.request("/workshop/search", fixture("red"), HTTP_X_ALBUM_CONSENT="")[1]["error"], "consent_required")
        self.assertEqual(self.request("/workshop/search", b"?", CONTENT_TYPE="image/gif")[0], 415)
        self.assertEqual(self.request("/workshop/search", b"?", CONTENT_LENGTH="9000000")[0], 413)
        self.assertEqual(self.request("/workshop/search", b"?")[1]["error"], "invalid_image")
        self.assertEqual(self.request("/workshop/search", fixture("black"))[1]["error"], "no_face")
        self.assertEqual(self.request("/workshop/search", fixture("green"))[1]["error"], "multiple_faces")
        with album.writer():
            self.assertEqual(self.request("/workshop/search", fixture("red"))[1]["error"], "busy")
        result = self.request("/workshop/search", fixture("red"))[1]
        photo_id = result["ids"][0]
        album.delete("workshop", photo_id)
        self.assertEqual(self.request(f"/workshop/{photo_id}/download")[0], 404)
        self.assertEqual(self.request("/workshop/search", fixture("red"))[1]["error"], "not_enrolled")
        self.assertEqual(album.import_batch("workshop", self.source)["skipped"], 2)
        album.purge("workshop")
        self.assertEqual(self.request("/workshop/photos")[0], 404)
        self.assertFalse(list(self.private.glob("*.jpg")))

    def test_opt_in_scopes_faces_and_revocation(self):
        self.seed()
        photo_id = self.enroll()
        self.assertTrue(self.request("/workshop/consent")[1]["indexed"])
        second = self.actor(member="another")
        self.assertEqual(self.request("/workshop/consent", b"", HTTP_X_ALBUM_ACTOR=second, HTTP_X_ALBUM_MEMBER="another",
                                      HTTP_X_ALBUM_CONSENT=album.CONSENT_VERSION)[0], 200)
        self.assertEqual(self.request("/workshop/search", fixture("red"), HTTP_X_ALBUM_ACTOR=second,
                                                       HTTP_X_ALBUM_MEMBER="another")[1]["error"],
                         "not_enrolled")
        with self.assertRaisesRegex(ValueError, "precisa autorizar"):
            album.index_opt_in("workshop", "unconsented", photo_id, (0, 0, 1, 1), "x" * 32)
        self.assertEqual(self.request("/workshop/consent", REQUEST_METHOD="DELETE"),
                         (200, {"granted": False, "indexed": False}))
        with album.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM opt_in_region").fetchone()[0], 0)
        self.service = Service("x" * 32, None)
        self.assertEqual(self.request("/workshop/photos")[0], 200)
        self.assertEqual(self.request("/workshop/search", fixture("red"))[0], 404)

    def test_validate_only_checks_selfie_and_never_saves_a_photo(self):
        self.seed()
        original_files = set(self.private.glob("*.jpg"))
        self.assertEqual(self.request("/workshop/validate", fixture("red")),
                         (400, {"error": "consent_required"}))
        self.assertEqual(self.request("/workshop/consent", b"", HTTP_X_ALBUM_CONSENT=album.CONSENT_VERSION),
                         (200, {"granted": True, "indexed": False}))
        self.assertEqual(self.request("/workshop/search", fixture("red")), (409, {"error": "not_enrolled"}))

        with patch.object(self.service, "match_regions", side_effect=AssertionError("Album was scanned")):
            self.assertEqual(self.request("/workshop/validate", fixture("red")), (200, {"validated": True}))
            self.assertEqual(self.request("/workshop/validate", fixture("black")), (422, {"error": "no_face"}))
            self.assertEqual(self.request("/workshop/validate", fixture("lime")), (422, {"error": "multiple_faces"}))
            self.enroll()
            self.assertEqual(self.request("/workshop/validate", fixture("red")), (200, {"validated": True}))

        self.assertEqual(self.request("/workshop/saved"), (200, {"ids": []}))
        self.assertEqual(set(self.private.glob("*.jpg")), original_files)

    def test_search_saves_only_original_photo_ids_per_account(self):
        self.seed()
        photo_id = self.enroll()
        original_files = set(self.private.glob("*.jpg"))
        for _ in range(2):
            self.assertEqual(self.request("/workshop/search", fixture("red")), (200, {"ids": [photo_id]}))
        self.assertEqual(self.request("/workshop/search", fixture("blue")), (200, {"ids": []}))
        self.assertEqual(set(self.private.glob("*.jpg")), original_files)

        self.service = Service("x" * 32, None)
        self.assertEqual(self.request("/workshop/saved"), (200, {"ids": [photo_id]}))
        self.assertEqual(self.request(f"/workshop/saved/{photo_id}")[0], 200)
        second = dict(HTTP_X_ALBUM_ACTOR=self.actor(member="another"), HTTP_X_ALBUM_MEMBER="another")
        self.assertEqual(self.request("/workshop/saved", **second), (200, {"ids": []}))
        self.assertEqual(self.request(f"/workshop/saved/{photo_id}", **second)[0], 404)
        self.assertEqual(self.request("/workshop/saved", HTTP_X_ALBUM_MEMBER="another")[0], 400)
        with album.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM saved_photo").fetchone()[0], 1)
            self.assertIsNone(db.execute("SELECT name FROM sqlite_schema WHERE name='opt_in_face'").fetchone())
        album.delete("workshop", photo_id)
        self.assertEqual(self.request("/workshop/saved"), (200, {"ids": []}))

    def test_upgrade_removes_legacy_vectors_from_live_database(self):
        with album.connect() as db:
            db.execute("CREATE TABLE opt_in_face (embedding BLOB)")
            marker = b"fixture-legacy-vector-to-be-erased" * 64
            db.execute("INSERT INTO opt_in_face VALUES (?)", (marker,))
        album.upgrade()
        album.upgrade()
        with album.connect() as db:
            self.assertIsNone(db.execute("SELECT name FROM sqlite_schema WHERE name='opt_in_face'").fetchone())
            self.assertEqual(db.execute("SELECT count(*) FROM album").fetchone()[0], 2)
        self.assertNotIn(marker[:100], (self.private / "album.sqlite3").read_bytes())

    def test_indefinite_gallery_does_not_extend_face_retention(self):
        with album.connect() as db:
            db.execute("UPDATE album SET expires=NULL WHERE id='workshop'")
        self.seed()
        photo_id = self.enroll()
        self.assertEqual(self.request("/workshop/search", fixture("red")), (200, {"ids": [photo_id]}))
        with album.connect() as db:
            db.execute("UPDATE opt_in SET expires=0 WHERE event='workshop'")
        self.assertEqual(self.request("/workshop/photos")[1]["expires"], None)
        self.assertEqual(self.request("/workshop/search", fixture("red"))[1]["error"], "consent_required")
        album.purge()
        self.assertEqual(self.request(f"/workshop/{photo_id}/download")[0], 200)
        self.assertEqual(self.request("/workshop/saved"), (200, {"ids": [photo_id]}))
        with album.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM opt_in_region").fetchone()[0], 0)

    def test_expiry_hides_and_removes_media(self):
        self.seed()
        photo_id = self.request("/workshop/photos")[1]["ids"][0]
        with album.connect() as db:
            db.execute("UPDATE album SET expires=0 WHERE id='workshop'")
        self.assertEqual(self.request(f"/workshop/{photo_id}/download")[0], 404)
        self.assertEqual(self.request("/workshop/search", fixture("red"))[0], 404)
        album.purge()
        self.assertFalse(list(self.private.glob("*.jpg")))
        self.assertEqual(self.request("/otro-evento/photos")[0], 200)

    def test_video_stays_private(self):
        video = self.source / "fixture.mp4"
        video.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"fixture")
        album.import_video("workshop", video)
        self.assertTrue(self.request("/workshop/photos")[1]["video"])
        self.assertEqual(self.request("/workshop/video"), (200, video.read_bytes()))
        self.assertEqual(self.request("/otro-evento/video")[0], 404)
        album.delete_video("workshop")
        self.assertEqual(self.request("/workshop/video")[0], 404)


if __name__ == "__main__":
    unittest.main()
