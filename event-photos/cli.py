import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from album import connect, delete, delete_video, import_batch, import_video, purge, start
from vision import MODEL, Vision, models


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("models")
    init = sub.add_parser("init")
    init.add_argument("event")
    init.add_argument("--expires", required=True, help="ISO 8601 com fuso")
    init.add_argument("--authorization", required=True, help="Referência interna, sem dados pessoais")
    batch = sub.add_parser("import")
    batch.add_argument("event")
    batch.add_argument("folder", type=Path)
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
        expires = datetime.fromisoformat(args.expires)
        if expires.tzinfo is None:
            raise ValueError("Informe o fuso da data de expiração")
        start(args.event, int(expires.timestamp()), args.authorization)
    elif args.command == "import":
        counts = import_batch(args.event, args.folder, Vision())
        print(json.dumps(counts))
        return 2 if counts["errors"] else 0
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
