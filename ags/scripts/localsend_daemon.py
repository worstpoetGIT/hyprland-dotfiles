#!/usr/bin/env python3
"""LocalSend protocol v2 daemon: HTTP receiver + UDP multicast discovery +
a localhost-only control API the AGS widget talks to. Protocol mode is
plain HTTP (not HTTPS) — a spec-valid mode that skips self-signed
cert/fingerprint-pinning entirely.
"""
import json
import mimetypes
import os
import secrets
import socket
import struct
import sys
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PROTO_PORT = 53317
CONTROL_PORT = 53318
MCAST_GRP = "224.0.0.167"
ALIAS = "Arch-Thinkpad"
DOWNLOAD_DIR = os.path.expanduser("~/Downloads")
STATE_PATH = os.path.expanduser("~/.config/ags/scripts/localsend_state.json")
LOG_PATH = os.path.expanduser("~/.cache/localsend-daemon.log")

peers_lock = threading.Lock()
peers = {}  # fingerprint -> {alias, ip, port, protocol, deviceModel, deviceType, lastSeen}

sessions_lock = threading.Lock()
sessions = {}  # sessionId -> {fileId: {token, fileName, path, size, written}}

received_lock = threading.Lock()
received = []  # list of {name, size, from, time}, most recent last


def log(msg):
    try:
        with open(LOG_PATH, "a") as f:
            f.write(f"{datetime.now().isoformat()} {msg}\n")
    except Exception:
        pass


def load_fingerprint():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)["fingerprint"]
    except Exception:
        fp = secrets.token_hex(16)
        os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
        with open(STATE_PATH, "w") as f:
            json.dump({"fingerprint": fp}, f)
        return fp


FINGERPRINT = load_fingerprint()


def my_info():
    return {
        "alias": ALIAS,
        "version": "2.0",
        "deviceModel": "Linux",
        "deviceType": "desktop",
        "fingerprint": FINGERPRINT,
        "port": PROTO_PORT,
        "protocol": "http",
        "download": False,
    }


def unique_dest_path(filename):
    dest = os.path.join(DOWNLOAD_DIR, filename)
    if not os.path.exists(dest):
        return dest
    base, ext = os.path.splitext(filename)
    n = 1
    while True:
        candidate = os.path.join(DOWNLOAD_DIR, f"{base} ({n}){ext}")
        if not os.path.exists(candidate):
            return candidate
        n += 1


class ProtoHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log("proto: " + (fmt % args))

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""
        return json.loads(raw) if raw else {}

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/localsend/v2/info":
            self._json(200, my_info())
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/localsend/v2/register":
            try:
                body = self._read_json_body()
                fp = body.get("fingerprint")
                ip = self.client_address[0]
                if fp and fp != FINGERPRINT:
                    with peers_lock:
                        peers[fp] = {**body, "ip": ip, "lastSeen": time.time()}
            except Exception as e:
                log(f"register parse error: {e}")
            self._json(200, my_info())
            return

        if path == "/api/localsend/v2/prepare-upload":
            try:
                body = self._read_json_body()
            except Exception:
                self._json(400, {"error": "invalid body"})
                return
            files = body.get("files", {})
            session_id = secrets.token_hex(8)
            session = {}
            resp_files = {}
            for file_id, meta in files.items():
                token = secrets.token_hex(8)
                filename = meta.get("fileName", file_id)
                dest = unique_dest_path(filename)
                session[file_id] = {
                    "token": token,
                    "fileName": filename,
                    "path": dest,
                    "size": meta.get("size", 0),
                }
                resp_files[file_id] = token
            with sessions_lock:
                sessions[session_id] = session
            sender_alias = (body.get("info") or {}).get("alias", "unknown")
            log(f"prepare-upload from {sender_alias}: {list(session.keys())}")
            self._json(200, {"sessionId": session_id, "files": resp_files})
            return

        if path == "/api/localsend/v2/upload":
            session_id = qs.get("sessionId", [None])[0]
            file_id = qs.get("fileId", [None])[0]
            token = qs.get("token", [None])[0]
            with sessions_lock:
                session = sessions.get(session_id)
                entry = session.get(file_id) if session else None
            if not entry or entry["token"] != token:
                self._json(403, {"error": "invalid session/token"})
                return
            length = int(self.headers.get("Content-Length", 0))
            remaining = length
            os.makedirs(DOWNLOAD_DIR, exist_ok=True)
            try:
                with open(entry["path"], "wb") as out:
                    while remaining > 0:
                        chunk = self.rfile.read(min(65536, remaining))
                        if not chunk:
                            break
                        out.write(chunk)
                        remaining -= len(chunk)
            except Exception as e:
                log(f"upload write error: {e}")
                self._json(500, {"error": "write failed"})
                return
            with received_lock:
                received.append({
                    "name": entry["fileName"],
                    "size": length,
                    "from": self.client_address[0],
                    "time": datetime.now(timezone.utc).isoformat(),
                })
                del received[:-20]
            log(f"received {entry['fileName']} ({length} bytes) -> {entry['path']}")
            self._json(200, {})
            return

        if path == "/api/localsend/v2/cancel":
            session_id = qs.get("sessionId", [None])[0]
            with sessions_lock:
                sessions.pop(session_id, None)
            self._json(200, {})
            return

        self._json(404, {"error": "not found"})


class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log("control: " + (fmt % args))

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/peers":
            cutoff = time.time() - 30
            with peers_lock:
                stale = [fp for fp, p in peers.items() if p["lastSeen"] < cutoff]
                for fp in stale:
                    del peers[fp]
                out = [
                    {
                        "alias": p.get("alias", "?"),
                        "ip": p["ip"],
                        "port": p.get("port", PROTO_PORT),
                        "deviceType": p.get("deviceType", "desktop"),
                    }
                    for p in peers.values()
                ]
            self._json(200, out)
        elif path == "/received":
            with received_lock:
                self._json(200, list(reversed(received)))
        elif path == "/status":
            self._json(200, {"running": True, "alias": ALIAS, "fingerprint": FINGERPRINT})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/send":
            length = int(self.headers.get("Content-Length", 0))
            try:
                body = json.loads(self.rfile.read(length))
                result = do_send(body["path"], body["ip"], int(body["port"]))
                self._json(200, result)
            except Exception as e:
                self._json(500, {"ok": False, "message": str(e)})
        else:
            self._json(404, {"error": "not found"})


def do_send(path, ip, port):
    if not os.path.isfile(path):
        return {"ok": False, "message": "file not found"}
    filename = os.path.basename(path)
    size = os.path.getsize(path)
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    file_id = "f1"

    prep_body = json.dumps({
        "info": my_info(),
        "files": {file_id: {"id": file_id, "fileName": filename, "size": size, "fileType": mime}},
    }).encode()

    base = f"http://{ip}:{port}/api/localsend/v2"
    req = urllib.request.Request(f"{base}/prepare-upload", data=prep_body,
                                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            prep = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return {"ok": False, "message": "receiver requires a PIN (not supported yet)"}
        if e.code == 403:
            return {"ok": False, "message": "rejected by receiver"}
        return {"ok": False, "message": f"prepare-upload failed: HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "message": f"could not reach device: {e}"}

    session_id = prep["sessionId"]
    token = prep["files"][file_id]

    with open(path, "rb") as fh:
        up_req = urllib.request.Request(
            f"{base}/upload?sessionId={session_id}&fileId={file_id}&token={token}",
            data=fh, headers={"Content-Type": "application/octet-stream"}, method="POST",
        )
        try:
            urllib.request.urlopen(up_req, timeout=120)
        except Exception as e:
            return {"ok": False, "message": f"upload failed: {e}"}

    log(f"sent {filename} to {ip}:{port}")
    return {"ok": True, "message": f"Sent {filename}"}


def multicast_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", PROTO_PORT))
    mreq = struct.pack("4sl", socket.inet_aton(MCAST_GRP), socket.INADDR_ANY)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
    while True:
        try:
            data, addr = sock.recvfrom(8192)
            body = json.loads(data.decode())
            fp = body.get("fingerprint")
            if not fp or fp == FINGERPRINT:
                continue
            with peers_lock:
                peers[fp] = {**body, "ip": addr[0], "lastSeen": time.time()}
        except Exception as e:
            log(f"multicast listen error: {e}")


def multicast_announcer():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    payload = json.dumps({**my_info(), "announce": True}).encode()
    while True:
        try:
            sock.sendto(payload, (MCAST_GRP, PROTO_PORT))
        except Exception as e:
            log(f"multicast announce error: {e}")
        time.sleep(5)


def main():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    threading.Thread(target=multicast_listener, daemon=True).start()
    threading.Thread(target=multicast_announcer, daemon=True).start()

    proto_srv = ThreadingHTTPServer(("0.0.0.0", PROTO_PORT), ProtoHandler)
    control_srv = ThreadingHTTPServer(("127.0.0.1", CONTROL_PORT), ControlHandler)

    threading.Thread(target=proto_srv.serve_forever, daemon=True).start()
    log(f"localsend daemon up: proto=0.0.0.0:{PROTO_PORT} control=127.0.0.1:{CONTROL_PORT} fingerprint={FINGERPRINT}")
    control_srv.serve_forever()


if __name__ == "__main__":
    main()
