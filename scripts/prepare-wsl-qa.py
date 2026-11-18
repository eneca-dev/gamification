"""Bootstrap the approved, loopback-only QA backend inside Ubuntu 24.04 WSL.

Run from Windows: wsl -d Ubuntu-24.04 -u root --exec python3
  /mnt/d/EnecaProjects/Gamification/scripts/prepare-wsl-qa.py
Never reads application env files or connects to an existing database.
"""
import base64
import hashlib
import hmac
import http.client
import http.server
import json
import os
from pathlib import Path
import platform
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import zipfile

REPO = Path(__file__).resolve().parent.parent
GO_VERSION = "1.27.4"
GO_SHA = "7226736c2339719cda28fbf3a54d71aa63bcefe376e98cef00034268dab24840"
AUTH_VERSION = "2.198.0"
AUTH_SHA = "44864b95510681e26406c71b2b464141f5a6e65e4db8061eb93d0b023562ef6d"
REST_VERSION = "16.6"
REST_SHA = "335ea29f00145705fb569b1268b9c8e53d062f8f6f9188192e92ea3781d2dca1"
PORTS = {"postgres": 55438, "auth": 55439, "rest": 55440, "gateway": 55441}
BASE_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C.UTF-8"}


def jwt(secret, role):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")
    payload = {"role": role, "iss": "local-roulette-qa", "iat": int(time.time()), "exp": int(time.time()) + 86400 * 7}
    data = encode({"alg": "HS256", "typ": "JWT"}) + b"." + encode(payload)
    return (data + b"." + base64.urlsafe_b64encode(hmac.digest(secret.encode(), data, "sha256")).rstrip(b"=")).decode()


def safe_member(name):
    return bool(name) and not name.startswith(("/", "\\")) and ".." not in name.replace("\\", "/").split("/") and ":" not in name


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def extract_go_archive(archive, destination):
    with tarfile.open(archive) as bundle:
        members = bundle.getmembers()
        for member in members:
            # tarfile normalizes the archive's root directory "go/" to "go".
            inside_go = member.name.startswith("go/") or (member.name == "go" and member.isdir())
            if not safe_member(member.name) or not inside_go or not (member.isfile() or member.isdir()):
                raise RuntimeError(f"Unsafe Go archive member: {member.name!r} (type={member.type!r})")
        bundle.extractall(destination, members=members, filter="data")


def request(port, path, *, token=None, apikey=None, data=None):
    # No external URLs or redirects; all requests are to this new local backend.
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=8)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if apikey:
        headers["apikey"] = apikey
    try:
        connection.request("POST" if data is not None else "GET", path,
                           json.dumps(data) if data is not None else None, headers)
        response = connection.getresponse()
        body = response.read()
        return response.status, json.loads(body) if body else None
    finally:
        connection.close()


def gateway_server(config, port=55441):
    class Gateway(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Never log credentials, request bodies or query strings.

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

        def cors(self):
            origin = self.headers.get("Origin", "")
            if origin in ("http://127.0.0.1:3011", "http://localhost:3011"):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Headers", "authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer")
                self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")

        def forward(self):
            if self.headers.get("apikey") not in (config["anonKey"], config["serviceKey"]):
                self.send_error(401)
                return
            target = next(((prefix, port) for prefix, port in
                           (("/auth/v1", PORTS["auth"]), ("/rest/v1", PORTS["rest"]))
                           if self.path == prefix or self.path.startswith(prefix + "/") or self.path.startswith(prefix + "?")), None)
            if not target:
                self.send_error(404)
                return
            if self.headers.get("Transfer-Encoding"):
                self.send_error(400)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.send_error(400)
                return
            if not 0 <= length <= 1024 * 1024:
                self.send_error(413)
                return
            prefix, port = target
            route = self.path[len(prefix):] or "/"
            if route.startswith("?"):
                route = "/" + route
            upstream = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
            excluded = {"host", "connection", "transfer-encoding", "content-length"}
            headers = {k: v for k, v in self.headers.items() if k.lower() not in excluded}
            try:
                upstream.request(self.command, route, self.rfile.read(length), headers)
                response = upstream.getresponse()
                body = response.read()
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in excluded and not key.lower().startswith("access-control-"):
                        self.send_header(key, value)
                self.cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except (OSError, http.client.HTTPException):
                self.send_error(502)
            finally:
                upstream.close()

        do_GET = do_POST = do_PATCH = do_DELETE = forward

    return http.server.ThreadingHTTPServer(("127.0.0.1", port), Gateway)


class Setup:
    def __init__(self):
        self.started = time.monotonic()
        self.deadline = self.started + 90 * 60  # Leaves preparation time inside the two-hour budget.
        self.run = Path(tempfile.mkdtemp(prefix="gamification-roulette-qa-", dir="/var/tmp"))
        self.run.chmod(0o755)
        self.processes = []
        self.pg_started = False
        self.current = "preflight"
        self.result = {"status": "preparing", "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       "directory": str(self.run), "ports": PORTS, "checks": {},
                       "versions": {"go": GO_VERSION, "auth": AUTH_VERSION, "postgrest": REST_VERSION, "postgres": "Ubuntu 16"},
                       "fullE2ePassed": False, "workingDatabaseConnected": False}
        self.output = REPO / "test-results/wsl-qa"
        self.output.mkdir(parents=True, exist_ok=True)
        self.log_output = self.output / self.run.name
        self.log_output.mkdir()
        self.result["windowsLogs"] = str(self.log_output)
        self.owner_password = secrets.token_hex(24)
        self.auth_password = secrets.token_hex(24)
        self.rest_password = secrets.token_hex(24)
        self.secret = secrets.token_hex(32)
        self.pg = Path("/usr/lib/postgresql/16/bin")

    def stage(self, label):
        self.current = label
        print("Running " + label, flush=True)
        self.save()

    def save(self):
        self.result.update(stage=self.current, elapsedSeconds=round(time.monotonic() - self.started))
        (self.output / "last-run.json").write_text(json.dumps(self.result, indent=2) + "\n")
        logs = list(self.run.glob("*.log"))
        if (self.run / "pg-data/server.log").exists():
            logs.append(self.run / "pg-data/server.log")
        private_values = [self.owner_password, self.auth_password, self.rest_password, self.secret]
        for user in getattr(self, "config", {}).get("users", []):
            private_values.append(user["password"])
        for log in logs:
            # Bounded tails for diagnosis from Windows; no secret values in copies.
            with log.open("rb") as stream:
                stream.seek(max(0, log.stat().st_size - 128 * 1024))
                content = stream.read().decode("utf-8", errors="replace")
            for value in private_values:
                content = content.replace(value, "[REDACTED]")
            (self.log_output / log.name).write_text(content, encoding="utf-8")

    def command(self, args, label, *, env=None, cwd=None, data=None):
        self.stage(label)
        with (self.run / (label + ".log")).open("wb") as log:
            child = subprocess.Popen([str(arg) for arg in args], cwd=cwd or self.run,
                                     env=env or BASE_ENV, stdin=subprocess.PIPE if data else subprocess.DEVNULL,
                                     stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                child.communicate(data.encode() if data else None, timeout=max(1, self.deadline - time.monotonic()))
            except BaseException:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
                raise
        if child.returncode:
            raise RuntimeError(label + " failed; see " + str(self.run / (label + ".log")))

    def download(self, url, name, expected=None):
        self.stage("download-" + name)
        dest = self.run / name
        with urllib.request.urlopen(url, timeout=60) as response, dest.open("wb") as out:
            shutil.copyfileobj(response, out)
        actual = digest(dest)
        if expected and actual != expected:
            raise RuntimeError(name + " SHA-256 mismatch")
        self.result.setdefault("downloads", {})[name] = {"url": url, "sha256": actual}
        return dest

    def sql(self, text, label, database="roulette_e2e"):
        self.command([self.pg / "psql", "-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "55438",
                      "-U", "qa_owner", "-d", database], label,
                     env={**BASE_ENV, "PGPASSWORD": self.owner_password}, data=text)

    def background(self, args, label, env=None, cwd=None):
        with (self.run / (label + ".log")).open("wb") as log:
            process = subprocess.Popen([str(arg) for arg in args], cwd=cwd or self.run, env=env or BASE_ENV,
                                       stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        self.processes.append(process)
        self.result.setdefault("pids", {})[label] = process.pid

    def wait_http(self, port, path, token=None):
        for _ in range(60):
            if any(p.poll() is not None for p in self.processes):
                raise RuntimeError("A backend process exited; inspect logs in " + str(self.run))
            try:
                status, body = request(port, path, token=token)
                if status == 200:
                    return body
            except (OSError, ValueError):
                pass
            time.sleep(1)
        raise RuntimeError("Health endpoint did not become ready on port " + str(port))

    def packages(self):
        if (self.pg / "initdb").exists():
            return
        # Only the new Ubuntu distro is changed. Do not start a default PG service.
        policy = Path("/usr/sbin/policy-rc.d")
        own_policy = not policy.exists()
        if own_policy:
            policy.write_text("#!/bin/sh\nexit 101\n")
            policy.chmod(0o755)
        config = Path("/etc/postgresql-common/createcluster.conf")
        own_config = not config.exists()
        if own_config:
            config.parent.mkdir(parents=True, exist_ok=True)
            config.write_text("create_main_cluster = false\n")
        try:
            env = {**BASE_ENV, "DEBIAN_FRONTEND": "noninteractive", "NEEDRESTART_MODE": "l"}
            self.command(["apt-get", "update"], "ubuntu-package-index", env=env)
            self.command(["apt-get", "-y", "-o", "Dpkg::Options::=--force-confold", "install", "--no-install-recommends",
                          "postgresql-16", "postgresql-client-16", "ca-certificates"], "ubuntu-packages", env=env)
        finally:
            if own_policy:
                policy.unlink(missing_ok=True)
            if own_config:
                config.unlink(missing_ok=True)

    def prepare_auth(self):
        archive = self.download("https://dl.google.com/go/go" + GO_VERSION + ".linux-amd64.tar.gz", "go.tar.gz", GO_SHA)
        extract_go_archive(archive, self.run)
        cached = REPO / "test-results/auth-native-spike-20261118/run-2026-11-18T12-54-46-403Z/auth.zip"
        if cached.exists() and digest(cached) == AUTH_SHA:
            archive = self.run / "auth.zip"
            shutil.copyfile(cached, archive)
        else:
            archive = self.download("https://codeload.github.com/supabase/auth/zip/refs/tags/v" + AUTH_VERSION, "auth.zip", AUTH_SHA)
        with zipfile.ZipFile(archive) as bundle:
            if any(not safe_member(m.filename) or not m.filename.startswith("auth-" + AUTH_VERSION + "/")
                   or (m.external_attr >> 16) & 0o170000 == 0o120000 for m in bundle.infolist()):
                raise RuntimeError("Unsafe Auth archive member")
            bundle.extractall(self.run)
        source = self.run / ("auth-" + AUTH_VERSION)
        env = {**BASE_ENV, "GOROOT": str(self.run / "go"), "GOPATH": str(self.run / "gopath"),
               "GOCACHE": str(self.run / "go-cache"), "GOMODCACHE": str(self.run / "go-modules"),
               "GOENV": "off", "GOTOOLCHAIN": "local", "GOWORK": "off", "GOPROXY": "https://proxy.golang.org",
               "GOSUMDB": "sum.golang.org", "GOFLAGS": "-mod=readonly", "CGO_ENABLED": "0", "GOMAXPROCS": "2", "GOTELEMETRY": "off"}
        go = self.run / "go/bin/go"
        self.command([go, "mod", "download"], "auth-dependencies", env=env, cwd=source)
        self.command([go, "mod", "verify"], "auth-dependency-integrity", env=env, cwd=source)
        self.command([go, "build", "-p", "2", "-buildvcs=false", "-ldflags",
                      "-X github.com/supabase/auth/internal/utilities.Version=v" + AUTH_VERSION,
                      "-o", self.run / "auth", "."], "auth-build", env=env, cwd=source)
        return source

    def prepare_rest(self):
        name = "postgrest-v" + REST_VERSION + "-linux-static-x86-64.tar.xz"
        url = "https://github.com/PostgREST/postgrest/releases/download/v" + REST_VERSION + "/" + name
        archive = self.download(url, name, REST_SHA)
        with tarfile.open(archive) as bundle:
            members = [m for m in bundle.getmembers() if m.isfile() and Path(m.name).name == "postgrest"]
            if len(members) != 1:
                raise RuntimeError("Unexpected PostgREST archive")
            with bundle.extractfile(members[0]) as src, (self.run / "postgrest").open("wb") as dest:
                shutil.copyfileobj(src, dest)
        (self.run / "postgrest").chmod(0o755)

    def start_pg(self):
        import pwd
        account = pwd.getpwnam("postgres")
        data = self.run / "pg-data"
        data.mkdir(mode=0o700)
        os.chown(data, account.pw_uid, account.pw_gid)
        password_file = data / "initial-password"
        password_file.write_text(self.owner_password)
        password_file.chmod(0o600)
        os.chown(password_file, account.pw_uid, account.pw_gid)
        # initdb requires an empty data directory; keep its password beside it.
        password_file = password_file.rename(self.run / "pg-password")
        self.command(["runuser", "-u", "postgres", "--", self.pg / "initdb", "-D", data,
                      "--username=qa_owner", "--pwfile=" + str(password_file), "--auth-host=scram-sha-256",
                      "--auth-local=peer", "--encoding=UTF8", "--locale=C.UTF-8"], "postgres-init")
        with (data / "postgresql.conf").open("a") as config:
            config.write("\nlisten_addresses='127.0.0.1'\nport=55438\nunix_socket_directories=''\n")
        self.pg_started = True  # Cleanup also covers a lost/failed pg_ctl startup response.
        self.command(["runuser", "-u", "postgres", "--", self.pg / "pg_ctl", "-D", data,
                      "-l", data / "server.log", "-w", "start"], "postgres-start")
        self.sql("create database roulette_e2e;", "create-isolated-database", "postgres")
        # Official Auth migrations grant SELECT to postgres; initdb used qa_owner.
        # This compatibility role cannot log in and needs no elevated privileges.
        self.sql("create role postgres nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;\n"
                 "create role supabase_auth_admin login password '" + self.auth_password + "';\n"
                 "create schema auth authorization supabase_auth_admin;\n"
                 "alter role supabase_auth_admin in database roulette_e2e set search_path=auth;\n"
                 "grant connect on database roulette_e2e to supabase_auth_admin;", "auth-database-role")

    def start_backend(self, source):
        self.config = {"marker": "isolated-wsl-roulette-qa-v1", "directory": str(self.run),
                       "baseUrl": "http://127.0.0.1:55441", "jwtSecret": self.secret,
                       "anonKey": jwt(self.secret, "anon"), "serviceKey": jwt(self.secret, "service_role"),
                       "database": {"host": "127.0.0.1", "port": 55438, "database": "roulette_e2e", "user": "qa_owner", "password": self.owner_password}}
        auth_env = {**BASE_ENV, "GOTRUE_DB_DRIVER": "postgres", "DB_NAMESPACE": "auth",
                    "DATABASE_URL": "postgres://supabase_auth_admin:" + self.auth_password + "@127.0.0.1:55438/roulette_e2e?sslmode=disable",
                    "API_EXTERNAL_URL": "http://127.0.0.1:55441/auth/v1", "GOTRUE_API_HOST": "127.0.0.1", "PORT": "55439",
                    "GOTRUE_SITE_URL": "http://127.0.0.1:3011", "GOTRUE_JWT_SECRET": self.secret,
                    "GOTRUE_JWT_AUD": "authenticated", "GOTRUE_JWT_ADMIN_ROLES": "service_role", "GOTRUE_JWT_DEFAULT_GROUP_NAME": "authenticated",
                    "GOTRUE_DISABLE_SIGNUP": "true", "GOTRUE_MAILER_AUTOCONFIRM": "true", "GOTRUE_EXTERNAL_EMAIL_ENABLED": "true",
                    "GOTRUE_DB_MIGRATIONS_PATH": str(source / "migrations"), "GOTRUE_DB_MAX_POOL_SIZE": "5"}
        self.command([self.run / "auth", "migrate"], "auth-schema-migrations", env=auth_env, cwd=source)
        self.background([self.run / "auth", "serve"], "auth-server", auth_env, source)
        self.result["checks"]["authHealth"] = self.wait_http(PORTS["auth"], "/health")
        baseline = (REPO / "tests/integration/fixtures/local-baseline.sql").read_text(encoding="utf-8-sig")
        placeholder = "create schema auth;\ncreate table auth.users(id uuid primary key);"
        if baseline.count(placeholder) != 1:
            raise RuntimeError("Baseline Auth placeholder changed; review required")
        self.sql(baseline.replace(placeholder, "-- Real Auth schema already installed."), "public-baseline")
        sql_root = REPO / "src/docs-features/roulette/sql"
        for name in ("01-roulette.review.sql", "02-reporting.review.sql"):
            self.result.setdefault("sqlSha256", {})[name] = digest(sql_root / name)
            self.sql((sql_root / name).read_text(encoding="utf-8-sig"), "apply-" + name)
        self.sql("create role authenticator login noinherit password '" + self.rest_password + "';\n"
                 "grant anon,authenticated,service_role to authenticator;\n"
                 "grant usage on schema public,auth to authenticated;\n"
                 "grant select on public.profiles to authenticated;\n"
                 "create policy qa_own_profile on public.profiles for select to authenticated using (user_id=auth.uid());\n"
                 "create schema qa_guard; create table qa_guard.environment(marker text primary key);\n"
                 "insert into qa_guard.environment values ('isolated-wsl-roulette-qa-v1');\n"
                 "insert into public.crystal_rates(rate) values(80);", "local-rest-access")
        rest_env = {**BASE_ENV, "PGRST_DB_URI": "postgres://authenticator:" + self.rest_password + "@127.0.0.1:55438/roulette_e2e",
                    "PGRST_DB_SCHEMAS": "public", "PGRST_DB_ANON_ROLE": "anon", "PGRST_DB_CONFIG": "false",
                    "PGRST_JWT_SECRET": self.secret, "PGRST_SERVER_HOST": "127.0.0.1", "PGRST_SERVER_PORT": "55440"}
        self.background([self.run / "postgrest"], "postgrest-server", rest_env)
        self.wait_http(PORTS["rest"], "/", self.config["serviceKey"])
        local_config = self.run / "runtime.json"
        local_config.write_text(json.dumps(self.config))
        local_config.chmod(0o600)
        self.background([sys.executable, Path(__file__).resolve(), "--gateway", local_config], "gateway-server")
        for _ in range(30):
            try:
                if request(PORTS["gateway"], "/auth/v1/health", apikey=self.config["anonKey"])[0] == 200:
                    break
            except OSError:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("Gateway health failed")
        self.result["checks"]["gatewayHealth"] = True

    def verify_login(self):
        self.stage("synthetic-user-login")
        self.config["users"] = []
        for name in ("pilot", "denied"):
            ws_id = str(uuid.uuid4())
            email = name + "@roulette.example.invalid"
            password = secrets.token_urlsafe(24)
            status, user = request(PORTS["auth"], "/admin/users", token=self.config["serviceKey"], data={
                "email": email, "password": password, "email_confirm": True,
                "app_metadata": {"ws_user_id": ws_id, "is_admin": False}})
            if status not in (200, 201) or "id" not in user:
                raise RuntimeError("Synthetic user creation failed: HTTP " + str(status))
            auth_id = str(uuid.UUID(user["id"]))
            self.sql("insert into public.ws_users(id,ws_user_id,email,user_id,first_name,last_name) values ('" + ws_id + "','qa-" + name + "','" + email + "','" + auth_id + "','QA','" + name + "');\n"
                     "insert into public.profiles(user_id,email,first_name,last_name) values ('" + auth_id + "','" + email + "','QA','" + name + "');\n"
                     "insert into public.gamification_balances(user_id,total_coins) values ('" + ws_id + "',1000);", "fixture-" + name)
            status, session = request(PORTS["gateway"], "/auth/v1/token?grant_type=password", apikey=self.config["anonKey"], data={"email": email, "password": password})
            if status != 200 or not session.get("access_token"):
                raise RuntimeError("Password login failed: HTTP " + str(status))
            status, verified = request(PORTS["gateway"], "/auth/v1/user", apikey=self.config["anonKey"], token=session["access_token"])
            if status != 200 or verified.get("id") != auth_id or verified.get("app_metadata", {}).get("ws_user_id") != ws_id:
                raise RuntimeError("Authenticated user identity mismatch")
            self.config["users"].append({"name": name, "email": email, "password": password, "authId": auth_id, "wsUserId": ws_id})
        status, _ = request(PORTS["gateway"], "/auth/v1/user", apikey=self.config["anonKey"])
        if status != 401:
            raise RuntimeError("Auth did not reject a missing session")
        status, settings = request(PORTS["gateway"], "/rest/v1/roulette_settings?select=enabled", apikey=self.config["serviceKey"], token=self.config["serviceKey"])
        if status != 200 or settings != [{"enabled": False}]:
            raise RuntimeError("Expected disabled local roulette")
        self.result["checks"].update(passwordLogin=True, getUser=True, missingSessionRejected=True, localRouletteDisabled=True)
        self.result["status"] = "backend_ready_app_e2e_pending"
        # Local synthetic credentials only; never load .env.local or any production key.
        (self.run / "runtime.json").write_text(json.dumps(self.config, indent=2))
        (self.output / "runtime.local.json").write_text(json.dumps(self.config, indent=2))

    def cleanup_failure(self):
        for process in reversed(self.processes):
            try:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
            except ProcessLookupError:
                pass  # An owned child may exit between poll and signal; continue cleanup.
        if self.pg_started:
            args = ["runuser", "-u", "postgres", "--", str(self.pg / "pg_ctl"), "-D", str(self.run / "pg-data")]
            status = subprocess.run([*args, "status"], env=BASE_ENV, capture_output=True, timeout=5)
            if status.returncode == 0:
                subprocess.run([*args, "-m", "fast", "-w", "stop"], env=BASE_ENV,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=True)
            elif status.returncode != 3:
                raise RuntimeError("Cannot confirm owned PostgreSQL process status")


def main():
    if "--plan" in sys.argv:
        print(json.dumps({"distro": "Ubuntu-24.04", "ports": PORTS, "runtimeLimitMinutes": 90,
                          "workingDatabase": False, "applicationEnvRead": False, "windowsChanges": False,
                          "ubuntuPackages": ["postgresql-16", "postgresql-client-16", "ca-certificates"],
                          "result": "Backend health and synthetic Auth login; application E2E remains pending"}, indent=2))
        return
    if sys.platform != "linux" or os.geteuid() != 0 or platform.machine() != "x86_64":
        raise SystemExit("Run only as root in the approved Ubuntu-24.04 WSL distro (x86_64)")
    if "microsoft" not in platform.release().lower() or 'VERSION_ID="24.04"' not in Path("/etc/os-release").read_text():
        raise SystemExit("Expected Ubuntu 24.04 inside WSL")
    if "--gateway" in sys.argv:
        config = json.loads(Path(sys.argv[sys.argv.index("--gateway") + 1]).read_text())
        if config.get("marker") != "isolated-wsl-roulette-qa-v1":
            raise SystemExit("Local runtime marker missing")
        gateway_server(config).serve_forever()
        return
    for port in PORTS.values():
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", port))  # Occupied ports stop setup; never kill unrelated processes.
    if shutil.disk_usage("/var/tmp").free < 6 * 1024**3:
        raise SystemExit("At least 6 GiB free space required for this local setup")
    os.umask(0o077)
    setup = Setup()
    def expired(_signum, _frame):
        raise TimeoutError("90-minute setup execution limit reached")
    signal.signal(signal.SIGALRM, expired)
    signal.signal(signal.SIGTERM, expired)
    signal.alarm(90 * 60)
    try:
        setup.packages()
        source = setup.prepare_auth()
        setup.prepare_rest()
        setup.start_pg()
        setup.start_backend(source)
        setup.verify_login()
    except BaseException as error:
        signal.alarm(0)
        setup.result.update(status="blocked", error=str(error))
        try:
            setup.cleanup_failure()
            setup.result["failureProcessesStopped"] = True
        except Exception as cleanup_error:
            setup.result["cleanupError"] = str(cleanup_error)
        raise
    finally:
        signal.alarm(0)
        setup.save()
        print("Result: " + setup.result["status"] + "; logs: " + str(setup.run), flush=True)
    # Keep WSL attached to this terminal until acceptance; no Windows service.
    print("Backend ready. Keep this terminal open. Ctrl+C stops only this QA backend.", flush=True)
    try:
        while True:
            if any(process.poll() is not None for process in setup.processes):
                raise RuntimeError("A QA backend process stopped unexpectedly")
            time.sleep(5)
    except KeyboardInterrupt:
        setup.result["status"] = "stopped"
    except Exception as error:
        setup.result.update(status="blocked", error=str(error))
    finally:
        setup.cleanup_failure()
        setup.save()


if __name__ == "__main__":
    main()
