import argparse
import json
import os
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

from album import connect, delete, delete_video, import_batch, import_video, index_opt_in, purge, start
from vision import MODEL, models


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("models")
    init = sub.add_parser("init")
    init.add_argument("event")
    retention = init.add_mutually_exclusive_group(required=True)
    retention.add_argument("--expires", help="ISO 8601 com fuso")
    retention.add_argument("--no-expiry", action="store_true", help="Manter a galeria até exclusão")
    init.add_argument("--authorization", required=True, help="Referência interna, sem dados pessoais")
    batch = sub.add_parser("import")
    batch.add_argument("event")
    batch.add_argument("folder", type=Path)
    opt_ins = sub.add_parser("list-opt-ins")
    opt_ins.add_argument("event")
    reference = sub.add_parser("index-opt-in")
    reference.add_argument("event")
    reference.add_argument("photo")
    reference.add_argument("--member-id", required=True)
    reference.add_argument("--box", required=True, type=float, nargs=4,
                           metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
    video = sub.add_parser("import-video")
    video.add_argument("event")
    video.add_argument("file", type=Path)
    remove_video = sub.add_parser("delete-video")
    remove_video.add_argument("event")
    status = sub.add_parser("status")
    status.add_argument("event")
    remove = sub.add_parser("delete-photo")
    remove.add_argument("event")
    remove.add_argument("photo")
    remove_album = sub.add_parser("delete-album")
    remove_album.add_argument("event")
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == "models":
        models(download=True)
        print(MODEL)
    elif args.command == "init":
        expires = None
        if not args.no_expiry:
            date = datetime.fromisoformat(args.expires)
            if date.tzinfo is None:
                raise ValueError("Informe o fuso da data de expiração")
            expires = int(date.timestamp())
        start(args.event, expires, args.authorization)
    elif args.command == "import":
        counts = import_batch(args.event, args.folder)
        print(json.dumps(counts))
        return 2 if counts["errors"] else 0
    elif args.command == "list-opt-ins":
        with connect() as db:
            rows = db.execute("""
                SELECT o.member_id, o.granted_at, o.expires, count(f.photo) AS photos
                FROM opt_in o LEFT JOIN opt_in_region f ON f.event=o.event AND f.actor=o.actor
                WHERE o.event=? AND o.expires>?
                GROUP BY o.member_id, o.granted_at, o.expires ORDER BY o.granted_at
            """, (args.event, time.time()))
            for row in rows:
                print(json.dumps(dict(row)))
    elif args.command == "index-opt-in":
        secret = os.getenv("ALBUM_SECRET", "")
        if os.getenv("ALBUM_SELFIE_ENABLED") != "true" or len(secret) < 32:
            raise ValueError("Ative ALBUM_SELFIE_ENABLED e configure o segredo do álbum")
        index_opt_in(args.event, args.member_id, args.photo, args.box, secret)
    elif args.command == "import-video":
        import_video(args.event, args.file)
    elif args.command == "delete-video":
        delete_video(args.event)
    elif args.command == "status":
        with connect() as db:
            rows = db.execute("SELECT id, name, model, state, error FROM photo WHERE event=? ORDER BY rowid",
                              (args.event,))
            for row in rows:
                print(json.dumps(dict(row)))
    elif args.command == "delete-photo":
        delete(args.event, args.photo)
    elif args.command == "delete-album":
        purge(args.event)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, sqlite3.Error) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
