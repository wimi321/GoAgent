#!/usr/bin/env python3
"""Serve the local concept review and save validated feedback beside it."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

MAX_BODY = 256 * 1024
FIELDS = {"id": 128, "geometryCorrect": 256, "intendedTerm": 1024,
          "useful": 256, "notes": 8192}


def validate_feedback(value, allowed_ids):
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "cases"}:
        raise ValueError("Expected schemaVersion and cases")
    if type(value["schemaVersion"]) is not int or value["schemaVersion"] != 1:
        raise ValueError("Unsupported schemaVersion")
    cases = value["cases"]
    if not isinstance(cases, list) or len(cases) > len(allowed_ids):
        raise ValueError("Invalid cases list")
    seen = set()
    for case in cases:
        if not isinstance(case, dict) or "id" not in case or set(case) - FIELDS.keys():
            raise ValueError("Invalid case fields")
        for field, text in case.items():
            if not isinstance(text, str) or len(text) > FIELDS[field]:
                raise ValueError("Invalid field type or length")
        if case["id"] not in allowed_ids or case["id"] in seen:
            raise ValueError("Unknown or duplicate case id")
        seen.add(case["id"])
    return value


def make_server(directory, port=8847):
    root = Path(directory).resolve()
    source = json.loads((root / "cases.json").read_text(encoding="utf-8"))
    allowed_ids = {case["id"] for case in source["cases"]}
    feedback_path = root / "feedback.json"
    save_lock = threading.Lock()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, format, *args):
            # Request paths and user feedback are deliberately not logged.
            pass

        def json_response(self, status, value):
            body = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def local_request(self):
            hosts = {f"127.0.0.1:{self.server.server_port}",
                     f"localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in hosts:
                self.json_response(403, {"ok": False, "error": "Local host required"})
                return False
            origins = self.headers.get_all("Origin", [])
            if origins and (len(origins) != 1 or origins[0] not in {"http://" + h for h in hosts}):
                self.json_response(403, {"ok": False, "error": "Origin rejected"})
                return False
            return True

        def send_head(self):
            # SimpleHTTPRequestHandler normalizes traversal; this additionally
            # rejects symlinks/junctions pointing outside the document root.
            candidate = Path(self.translate_path(self.path)).resolve()
            if not candidate.is_relative_to(root):
                self.send_error(403, "Outside document root")
                return None
            if candidate.is_dir():
                for name in ("index.html", "index.htm"):
                    index = candidate / name
                    if index.exists():
                        if not index.resolve().is_relative_to(root):
                            self.send_error(403, "Outside document root")
                            return None
                        break
            return super().send_head()

        def do_GET(self):
            if not self.local_request():
                return
            if urlsplit(self.path).path == "/api/feedback":
                try:
                    if not feedback_path.resolve().is_relative_to(root):
                        self.json_response(403, {"ok": False, "error": "Outside document root"})
                        return
                    value = (json.loads(feedback_path.read_text(encoding="utf-8"))
                             if feedback_path.exists() else {"schemaVersion": 1, "cases": []})
                    self.json_response(200, value)
                except (OSError, ValueError):
                    self.json_response(500, {"ok": False, "error": "Cannot read saved feedback"})
                return
            super().do_GET()

        def do_HEAD(self):
            if self.local_request():
                super().do_HEAD()

        def do_POST(self):
            if not self.local_request():
                return
            if self.path != "/api/feedback":
                self.json_response(404, {"ok": False, "error": "Unknown endpoint"})
                return
            if self.headers.get_content_type() != "application/json":
                self.json_response(415, {"ok": False, "error": "JSON content type required"})
                return
            try:
                if self.headers.get("Transfer-Encoding"):
                    raise ValueError("Transfer encoding unsupported")
                size = int(self.headers.get("Content-Length", "-1"))
                if size < 0:
                    raise ValueError("Content length required")
                if size > MAX_BODY:
                    self.json_response(413, {"ok": False, "error": "Feedback too large"})
                    return
                self.connection.settimeout(10)
                raw = self.rfile.read(size)
                if len(raw) != size:
                    raise ValueError("Incomplete body")
                value = validate_feedback(json.loads(raw), allowed_ids)
            except (ValueError, UnicodeError, OSError):
                self.json_response(400, {"ok": False, "error": "Invalid feedback"})
                return
            temporary = None
            try:
                with save_lock:
                    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root,
                                                     prefix=".feedback-", suffix=".tmp", delete=False) as out:
                        temporary = out.name
                        json.dump(value, out, ensure_ascii=False, indent=2)
                        out.write("\n")
                        out.flush()
                        os.fsync(out.fileno())
                    os.replace(temporary, feedback_path)
                self.json_response(200, {"ok": True, "savedCases": len(value["cases"]),
                                         "path": str(feedback_path)})
            except OSError:
                self.json_response(500, {"ok": False, "error": "Cannot save feedback"})
            finally:
                if temporary and os.path.exists(temporary):
                    os.unlink(temporary)

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8847)
    parser.add_argument("--directory", type=Path,
                        default=Path(__file__).resolve().parent.parent / ".tmp" / "concept-review")
    args = parser.parse_args()
    with make_server(args.directory, args.port) as server:
        print(f"Review: http://127.0.0.1:{server.server_port}/review.html", flush=True)
        print(f"Feedback: {args.directory.resolve() / 'feedback.json'}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
