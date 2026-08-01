#!/usr/bin/env python3
import http.server, json, os, sys

JSON_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'catalog_categories.json')

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/catalog_categories.json':
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data.encode())
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            # Remove internal fields
            clean = [{k: v for k, v in d.items() if not k.startswith('_')} for d in data]
            with open(JSON_FILE, 'w') as f:
                json.dump(clean, f, indent=2, ensure_ascii=False)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'count': len(clean)}).encode())
            print(f'Salvo: {len(clean)} entradas em {JSON_FILE}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        # Suppress default log
        pass

print(f'Servindo em http://localhost:8765')
print(f'Arquivo JSON: {JSON_FILE}')
print('Pressione Ctrl+C para parar')
server = http.server.HTTPServer(('127.0.0.1', 8765), Handler)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.shutdown()
    print('\nParado.')
