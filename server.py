# 本地开发服务器（禁用缓存版）
# 用法：python server.py  →  http://localhost:8123
# 与默认 http.server 的区别：所有响应带 no-cache 头，
# 保证改完代码刷新浏览器就能看到最新版本，不会被旧缓存卡住。
import http.server
import socketserver

PORT = 8123

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 静默访问日志

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'ChainVault dev server: http://localhost:{PORT}  (Cache-Control: no-store)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
