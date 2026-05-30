"""Simple HTTP server with CORS headers for Three.js static files."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(r'D:\Projects\thingsboard-smart-greenhouse\widget\v3_real_scene\assets')
    print(f'Serving from: {os.getcwd()}')
    print('CORS: enabled (Access-Control-Allow-Origin: *)')
    HTTPServer(('0.0.0.0', 9000), CORSRequestHandler).serve_forever()
