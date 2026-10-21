"""Exercise the production Caddy trust boundary with real TLS/QUIC 0-RTT.

Test-only dependency: scripts/http3-test-requirements.txt. No application,
database, email, Stripe credentials, or production data is used.
"""

import asyncio
import datetime
import http.client
import ipaddress
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from aioquic.asyncio import connect
from aioquic.asyncio.protocol import QuicConnectionProtocol
from aioquic.h3.connection import H3_ALPN, H3Connection
from aioquic.h3.events import DataReceived, HeadersReceived
from aioquic.quic.configuration import QuicConfiguration
from aioquic.quic.events import HandshakeCompleted
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID


class Client(QuicConnectionProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.http = H3Connection(self._quic)
        self.responses = {}
        self.handshake = None

    def quic_event_received(self, event):
        if isinstance(event, HandshakeCompleted):
            self.handshake = event
        for response in self.http.handle_event(event):
            if isinstance(response, (HeadersReceived, DataReceived)):
                future, headers, body = self.responses[response.stream_id]
                if isinstance(response, HeadersReceived):
                    headers.update(dict(response.headers))
                else:
                    body.extend(response.data)
                if response.stream_ended:
                    future.set_result((int(headers[b":status"]), bytes(body)))

    async def get(self, authority, headers=()):
        stream = self._quic.get_next_available_stream_id()
        future = asyncio.get_running_loop().create_future()
        self.responses[stream] = (future, {}, bytearray())
        self.http.send_headers(stream_id=stream, headers=[
            (b":method", b"GET"), (b":scheme", b"https"),
            (b":authority", authority.encode()),
            (b":path", b"/api/auth/verify-email?token=synthetic-invalid"),
            *headers,
        ], end_stream=True)
        self.transmit()
        return await asyncio.wait_for(future, 10)


class Backend(BaseHTTPRequestHandler):
    requests = 0

    def do_GET(self):
        type(self).requests += 1
        trusted = self.headers.get("X-Apogee-Client-IP", "")
        valid = trusted in ("127.0.0.1", "::1")
        body = json.dumps({
            "trustedPeerValid": valid,
            "forwardedMatchesPeer": self.headers.get("X-Forwarded-For") == trusted,
            "alternateHeadersRemoved": all(self.headers.get(name) is None for name in (
                "X-Real-IP", "X-Vercel-Forwarded-For", "CF-Connecting-IP", "Forwarded")),
        }).encode()
        self.send_response(200 if valid else 503)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass  # Never log request paths, headers, or peer addresses.


def certificate(directory):
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(minutes=1))
            .not_valid_after(now + datetime.timedelta(hours=1))
            .add_extension(x509.SubjectAlternativeName([
                x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
            ]), critical=False)
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .sign(key, hashes.SHA256()))
    cert_path, key_path = directory / "cert.pem", directory / "key.pem"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM,
                                         serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption()))
    key_path.chmod(0o600)
    return cert_path, key_path


def healthy(response):
    status, body = response
    assert status == 200, f"Verified connection returned {status}"
    assert all(json.loads(body).values()), "Proxy failed to overwrite spoofed IP headers"


async def probe(port, cert):
    tickets = []
    configuration = QuicConfiguration(is_client=True, alpn_protocols=H3_ALPN,
                                      server_name="localhost")
    configuration.load_verify_locations(cafile=str(cert))
    authority = f"localhost:{port}"
    async with connect("127.0.0.1", port, configuration=configuration,
                       create_protocol=Client, session_ticket_handler=tickets.append) as client:
        healthy(await client.get(authority))
        assert client.handshake.alpn_protocol == "h3"
        assert tickets and tickets[-1].max_early_data_size, "Server did not offer 0-RTT"
    configuration.session_ticket = tickets[-1]
    before = Backend.requests
    async with connect("127.0.0.1", port, configuration=configuration,
                       create_protocol=Client, wait_connected=False) as client:
        status, _ = await client.get(authority)
        assert client.handshake and client.handshake.session_resumed
        assert client.handshake.early_data_accepted, "Test did not exercise real 0-RTT"
        print(json.dumps({"protocol": "h3", "earlyDataAccepted": True,
                          "earlyStatus": status,
                          "earlyReachedBackend": Backend.requests != before}), flush=True)
        assert status == 425, f"Real 0-RTT must return 425 before proxying; got {status}"
        assert Backend.requests == before, "Early request reached application"
        # RFC 8470: retry only after the handshake, never as early data again.
        healthy(await client.get(authority))
        healthy(await client.get(authority, [
            (b"x-apogee-client-ip", b"198.51.100.10"),
            (b"x-forwarded-for", b"198.51.100.10"),
            (b"x-real-ip", b"198.51.100.10"),
            (b"cf-connecting-ip", b"198.51.100.10"),
            (b"x-vercel-forwarded-for", b"198.51.100.10"),
            (b"forwarded", b"for=198.51.100.10"),
            (b"early-data", b"1"),
        ]))


def main():
    source = Path(__file__).resolve().parents[1] / "infra/site/Caddyfile"
    production = source.read_text()
    body = production.split("www.apogee.community {", 1)[1].rsplit("}", 1)[0]
    backend = ThreadingHTTPServer(("127.0.0.1", 0), Backend)
    thread = threading.Thread(target=backend.serve_forever, daemon=True)
    thread.start()
    process = None
    with tempfile.TemporaryDirectory(prefix="apogee-http3-") as temp:
        directory = Path(temp)
        cert, key = certificate(directory)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        config = directory / "Caddyfile"
        body = body.replace("web:3000", f"127.0.0.1:{backend.server_port}")
        config.write_text("{\n admin off\n auto_https off\n}\n"
                          f"https://localhost:{port} {{\n bind 127.0.0.1\n"
                          f" tls {cert} {key}\n{body}\n}}\n")
        env = {**os.environ, "XDG_DATA_HOME": str(directory / "data"),
               "XDG_CONFIG_HOME": str(directory / "config")}
        try:
            # Logs remain private, and are not printed even on failure.
            with (directory / "caddy.log").open("w") as log:
                process = subprocess.Popen([os.environ["CADDY_BIN"], "run", "--config",
                                            str(config), "--adapter", "caddyfile"],
                                           stdout=log, stderr=log, env=env)
                context = ssl.create_default_context(cafile=str(cert))
                for _ in range(100):
                    assert process.poll() is None, "Isolated Caddy exited"
                    try:
                        conn = http.client.HTTPSConnection("localhost", port,
                                                           context=context, timeout=1)
                        conn.request("GET", "/health")
                        response = conn.getresponse()
                        healthy((response.status, response.read()))
                        conn.close()
                        break
                    except (ConnectionError, OSError):
                        time.sleep(0.05)
                else:
                    raise AssertionError("Isolated Caddy failed readiness")
                result = subprocess.run([
                    "curl", "--silent", "--show-error", "--fail", "--http2",
                    "--noproxy", "*", "--cacert", str(cert), "--max-time", "10",
                    "--write-out", "\n%{http_version}", f"https://localhost:{port}/health",
                ], check=True, capture_output=True, text=True)
                body, protocol = result.stdout.rsplit("\n", 1)
                assert protocol == "2", "Control probe did not negotiate HTTP/2"
                healthy((200, body.encode()))
                asyncio.run(probe(port, cert))
                print("PASS: HTTP/1.1, HTTP/2, HTTP/3, real 0-RTT rejection, safe retry, spoof protection")
        finally:
            if process is not None:
                process.terminate()
                process.wait(timeout=10)
            backend.shutdown()
            backend.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    main()
