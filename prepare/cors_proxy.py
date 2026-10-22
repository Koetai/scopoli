#!/usr/bin/env python3
"""A tiny CORS proxy for SPARQL endpoints that don't send CORS headers.

Browsers only let a web page (such as Scopoli) read answers from another
origin when that server says it's allowed, using Access-Control-* headers.
Some triplestores (Blazegraph, older Virtuoso set-ups) don't send them. This
proxy forwards every request to your endpoint and adds the headers.

Usage:
    python cors_proxy.py http://localhost:9999/bigdata/sparql 8899
then use http://localhost:8899 as the endpoint URL in Scopoli.
Only the Python standard library is needed.
"""
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TARGET = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:9999/bigdata/sparql"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8899
FORWARD = ("Accept", "Content-Type")


class Proxy(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
        # Chrome asks before a public site may call a server on your machine.
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def forward(self, body=None):
        query = self.path.partition("?")[2]
        url = TARGET + ("?" + query if query else "")
        headers = {h: self.headers[h] for h in FORWARD if self.headers[h]}
        req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                status, ctype, payload = resp.status, resp.headers.get("Content-Type"), resp.read()
        except urllib.error.HTTPError as e:
            status, ctype, payload = e.code, e.headers.get("Content-Type"), e.read()
        self.send_response(status)
        self.cors()
        if ctype:
            self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward(self.rfile.read(int(self.headers.get("Content-Length", 0))))


if __name__ == "__main__":
    print(f"Forwarding http://localhost:{PORT} -> {TARGET}")
    ThreadingHTTPServer(("localhost", PORT), Proxy).serve_forever()
