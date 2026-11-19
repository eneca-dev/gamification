"""Offline bootstrap guards and real loopback gateway checks; no WSL/DB setup."""
import base64
import hmac
import http.client
import http.server
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import tarfile
import threading
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("wsl_qa", ROOT / "scripts/prepare-wsl-qa.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class BootstrapGuards(unittest.TestCase):
    def test_go_root_directory_is_normalized_and_extracts(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / "go.tar.gz"
            with tarfile.open(archive, "w:gz") as bundle:
                root = tarfile.TarInfo("go/")
                root.type = tarfile.DIRTYPE
                bundle.addfile(root)
                version = tarfile.TarInfo("go/VERSION")
                version.size = len(b"go1.27.4")
                bundle.addfile(version, io.BytesIO(b"go1.27.4"))
            with tarfile.open(archive) as bundle:
                self.assertEqual(bundle.getmembers()[0].name, "go")
            qa.extract_go_archive(archive, Path(folder) / "extracted")
            self.assertEqual((Path(folder) / "extracted/go/VERSION").read_bytes(), b"go1.27.4")

    def test_go_archive_rejects_escape_links_special_files_and_root_file(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("go/../../escape", tarfile.REGTYPE),
                           ("/go/escape", tarfile.REGTYPE), ("other/file", tarfile.REGTYPE),
                           ("go", tarfile.REGTYPE), ("go/link", tarfile.SYMTYPE),
                           ("go/hardlink", tarfile.LNKTYPE), ("go/device", tarfile.CHRTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                archive = Path(folder) / "go.tar.gz"
                with tarfile.open(archive, "w:gz") as bundle:
                    good = tarfile.TarInfo("go/first-file")
                    bundle.addfile(good)
                    bad = tarfile.TarInfo(name)
                    bad.type = kind
                    if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                        bad.linkname = "../../escape"
                    bundle.addfile(bad)
                target = Path(folder) / "extracted"
                with self.assertRaisesRegex(RuntimeError, "Unsafe Go archive member:"):
                    qa.extract_go_archive(archive, target)
                self.assertFalse(target.exists(), "Validate every entry before extracting anything")

    def test_archive_paths(self):
        for name in ("/etc/passwd", "../escape", "go/../../escape", "C:/escape", "go\\..\\escape"):
            self.assertFalse(qa.safe_member(name), name)
        self.assertTrue(qa.safe_member("go/bin/go"))

    def test_local_service_token_signature_and_claims(self):
        token = qa.jwt("synthetic-secret", "service_role")
        head, payload, signature = token.split(".")
        decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        self.assertEqual(json.loads(decode(head)), {"alg": "HS256", "typ": "JWT"})
        claims = json.loads(decode(payload))
        self.assertEqual(claims["role"], "service_role")
        self.assertEqual(claims["iss"], "local-roulette-qa")
        self.assertGreater(claims["exp"], time.time())
        self.assertEqual(decode(signature), hmac.digest(b"synthetic-secret", (head + "." + payload).encode(), "sha256"))

    def test_sql_always_targets_fixed_local_cluster(self):
        setup = object.__new__(qa.Setup)
        setup.pg = Path("/usr/lib/postgresql/16/bin")
        setup.owner_password = "synthetic-password"
        with patch.object(setup, "command") as command, patch.dict(qa.os.environ, {"PGHOST": "production.invalid", "DATABASE_URL": "production.invalid"}):
            setup.sql("select 1", "read-only-test")
        args = command.call_args.args[0]
        self.assertEqual(args[args.index("-h") + 1], "127.0.0.1")
        self.assertEqual(args[args.index("-p") + 1], "55438")
        self.assertEqual(args[args.index("-d") + 1], "roulette_e2e")
        env = command.call_args.kwargs["env"]
        self.assertNotIn("PGHOST", env)
        self.assertNotIn("DATABASE_URL", env)

    def test_archive_digest_mismatch_stops_before_execution(self):
        setup = object.__new__(qa.Setup)
        with tempfile.TemporaryDirectory() as folder:
            setup.run = Path(folder)
            setup.result = {}
            with patch.object(setup, "stage"), patch.object(qa.urllib.request, "urlopen", return_value=io.BytesIO(b"unexpected")):
                with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                    setup.download("https://example.invalid/archive", "archive", "0" * 64)


class GatewayChecks(unittest.TestCase):
    def setUp(self):
        self.received = []
        received = self.received

        class Upstream(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def respond(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                received.append((self.command, self.path, body, self.headers.get("Authorization")))
                data = json.dumps({"received": True}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            do_GET = do_POST = respond

        self.upstream = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
        self.ports = patch.dict(qa.PORTS, {"auth": self.upstream.server_port, "rest": self.upstream.server_port})
        self.ports.start()
        self.gateway = qa.gateway_server({"anonKey": "synthetic-anon", "serviceKey": "synthetic-service"}, 0)
        self.threads = []
        for server in (self.upstream, self.gateway):
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.threads.append(thread)

    def tearDown(self):
        for server in (self.gateway, self.upstream):
            server.shutdown()
            server.server_close()
        for thread in self.threads:
            thread.join(timeout=2)
        self.ports.stop()

    def call(self, path, headers=None, body=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.gateway.server_port, timeout=3)
        try:
            connection.request("POST" if body is not None else "GET", path, body, headers or {})
            response = connection.getresponse()
            response.read()
            return response.status
        finally:
            connection.close()

    def test_missing_or_foreign_key_cannot_reach_backend(self):
        self.assertEqual(self.call("/auth/v1/user"), 401)
        self.assertEqual(self.call("/rest/v1/roulette_settings", {"apikey": "foreign-key"}), 401)
        self.assertEqual(self.received, [])

    def test_auth_request_body_token_and_query_reach_real_upstream(self):
        body = '{"email":"pilot@example.invalid","password":"synthetic"}'
        self.assertEqual(self.call("/auth/v1/token?grant_type=password", {"apikey": "synthetic-anon", "Authorization": "Bearer synthetic-token"}, body), 200)
        self.assertEqual(self.received, [("POST", "/token?grant_type=password", body.encode(), "Bearer synthetic-token")])

    def test_rest_query_preserved_and_unimplemented_services_not_faked(self):
        headers = {"apikey": "synthetic-service"}
        self.assertEqual(self.call("/rest/v1/roulette_settings?select=enabled", headers), 200)
        self.assertEqual(self.received[0][1], "/roulette_settings?select=enabled")
        self.assertEqual(self.call("/realtime/v1/websocket", headers), 404)
        self.assertEqual(self.call("/auth/v10/user", headers), 404)
        self.assertEqual(len(self.received), 1)

    def test_oversized_body_never_reaches_upstream(self):
        self.assertEqual(self.call("/auth/v1/token", {"apikey": "synthetic-anon", "Content-Length": "1048577"}, b""), 413)
        self.assertEqual(self.received, [])


if __name__ == "__main__":
    unittest.main()
