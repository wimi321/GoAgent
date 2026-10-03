"""Real HTTP behavior checks; all feedback is written to disposable fixtures."""
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location("review_server", Path(__file__).resolve().parents[1] / "serve_concept_review.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReviewServerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "cases.json").write_text(json.dumps({"cases": [{"id": "004:30"}]}))
        (self.root / "review.html").write_text("review fixture")
        self.server = module.make_server(self.root, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method="GET", body=None, headers=None, path="/api/feedback"):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        connection.request(method, path, body, headers or {})
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result

    def post(self, value, **headers):
        return self.request("POST", json.dumps(value, ensure_ascii=False).encode("utf-8"),
                            {"Content-Type": "application/json", **headers})

    def test_persist_and_reload(self):
        self.assertEqual(json.loads(self.request()[1]), {"schemaVersion": 1, "cases": []})
        value = {"schemaVersion": 1, "cases": [{"id": "004:30", "geometryCorrect": "正确",
                  "intendedTerm": "拆二", "useful": "有帮助", "notes": "中文反馈"}]}
        status, raw = self.post(value, Origin=f"http://127.0.0.1:{self.server.server_port}")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw), {"ok": True, "savedCases": 1, "path": str(self.root / "feedback.json")})
        self.assertEqual(json.loads((self.root / "feedback.json").read_text(encoding="utf-8")), value)
        self.assertEqual(json.loads(self.request()[1]), value)
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.server = module.make_server(self.root, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.assertEqual(json.loads(self.request()[1]), value)
        self.assertEqual(self.post({"schemaVersion": 1, "cases": [{"id": "unknown"}]})[0], 400)
        self.assertEqual(json.loads(self.request()[1]), value)
        self.assertEqual(list(self.root.glob(".feedback-*.tmp")), [])
        self.assertEqual(self.request(path="/review.html"), (200, b"review fixture"))

    def test_invalid_requests_do_not_write(self):
        invalid = [{"schemaVersion": 2, "cases": []},
                   {"schemaVersion": True, "cases": []},
                   {"schemaVersion": 1, "cases": [{"id": "unknown"}]},
                   {"schemaVersion": 1, "cases": [{"id": "004:30", "notes": 1}]},
                   {"schemaVersion": 1, "cases": [{"id": "004:30", "notes": "x" * 8193}]},
                   {"schemaVersion": 1, "cases": [{"id": "004:30", "path": "outside"}]}]
        for value in invalid:
            with self.subTest(value=str(value)[:80]):
                self.assertEqual(self.post(value)[0], 400)
        self.assertEqual(self.request("POST", b"{", {"Content-Type": "application/json"})[0], 400)
        self.assertEqual(self.post({"schemaVersion": 1, "cases": []}, Origin="https://example.com")[0], 403)
        self.assertEqual(self.request(headers={"Origin": "null"})[0], 403)
        self.assertEqual(self.request(headers={"Host": "example.com"})[0], 403)
        self.assertEqual(self.request("POST", b"{}", {"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request("POST", b"", {"Content-Type": "application/json",
                         "Content-Length": str(module.MAX_BODY + 1)})[0], 413)
        self.assertFalse((self.root / "feedback.json").exists())

    def test_static_stays_within_root(self):
        with tempfile.TemporaryDirectory() as outside:
            secret = Path(outside) / "secret.txt"
            secret.write_text("outside secret")
            self.assertNotIn(b"outside secret", self.request(path="/../secret.txt")[1])
            try:
                (self.root / "linked.txt").symlink_to(secret)
            except OSError:
                return  # Windows may require symlink privileges.
            self.assertEqual(self.request(path="/linked.txt")[0], 403)


if __name__ == "__main__":
    unittest.main()
