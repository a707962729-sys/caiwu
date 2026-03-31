#!/usr/bin/env python3
"""百度 OCR 本地代理，解决 Node.js 网络问题"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, sys, os

# 尝试导入 requests，不行则安装
try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests', '-q'])
    import requests

API_KEY = 'yb2BAkFhuYFyZbUkl63KO5uA'
SECRET_KEY = '4bBqL52gYuokaD300Bfn0ut1TIN0f6Ry'
TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token'
OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic'

_token = None

def get_token():
    global _token
    if _token:
        return _token
    try:
        r = requests.post(TOKEN_URL, data={'grant_type':'client_credentials','client_id':API_KEY,'client_secret':SECRET_KEY}, timeout=5)
        r.raise_for_status()
        _token = r.json().get('access_token')
        print(f'[OCR] Token: {_token[:20]}...', file=sys.stderr)
        return _token
    except Exception as e:
        print(f'[OCR] Token failed: {e}', file=sys.stderr)
        return None

def do_ocr(image_b64):
    tok = get_token()
    if not tok:
        return {'success': False, 'error': 'no token'}
    try:
        r = requests.post(f'{OCR_URL}?access_token={tok}', data={'image': image_b64}, timeout=10, headers={'Content-Type':'application/x-www-form-urlencoded'})
        r.raise_for_status()
        data = r.json()
        if 'words_result' in data:
            text = '\n'.join(w['words'] for w in data['words_result'])
            print(f'[OCR] OK len={len(text)}', file=sys.stderr)
            return {'success': True, 'text': text}
        print(f'[OCR] No words_result: {str(data)[:200]}', file=sys.stderr)
        return {'success': False, 'error': data}
    except Exception as e:
        print(f'[OCR] Failed: {e}', file=sys.stderr)
        global _token; _token = None
        return {'success': False, 'error': str(e)}

class H(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        if self.path != '/ocr':
            self.send_error(404); return
        try:
            cl = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(cl))
            img = body.get('image', '')
            if not img:
                self.send_error(400, 'no image'); return
            r = do_ocr(img)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(r).encode())
        except Exception as e:
            self.send_error(500, str(e))
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_error(404)

if __name__ == '__main__':
    PORT = 3333
    print(f'[OCR] Bridge on {PORT}', file=sys.stderr)
    HTTPServer(('', PORT), H).serve_forever()
