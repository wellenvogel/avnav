"""HTTP regression for #714. Run with PYTHONPATH=server:server/handler python3 -m unittest discover -s server/test -p test_user_http.py -v."""
import http.client
import tempfile
import threading
import time
import unittest
from pathlib import Path

from avndirectories import AVNImagesHandler, AVNUserHandler
from httphandler import AVNHTTPHandler
from httpserver import AVNHttpServer


class UserDirectoryHTTPTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        root = Path(cls.temp.name)
        files = {
            'user/docs/manual.txt': 'Boat manual',
            'user/docs/space & name.txt': 'Encoded name',
            'user/site/index.html': '<p>HTML index</p>',
            'user/site/index.htm': '<p>HTM index</p>',
            'user/short/index.htm': '<p>Short index</p>',
            'user/viewer/user.css': 'body { color: blue; }',
            'user/images/boat.svg': '<svg>boat</svg>',
            'user/icons/old.svg': '<svg>old</svg>',
            'viewer/main.html': '<p>Viewer</p>',
            'private.txt': 'Not in user directory',
        }
        for name, content in files.items():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
        params = dict(AVNHttpServer.getConfigParam(), DATADIR=str(root),
                      BASEDIR=str(root), httpHost='127.0.0.1', httpPort='0')
        cls.server = AVNHttpServer(params, AVNHTTPHandler)
        cls.server.updatePathMappings({})
        for handler_class in [AVNUserHandler, AVNImagesHandler]:
            handler = handler_class(params)
            cls.server.registerPathHandler(handler.getPrefix(), handler)
        cls.thread = threading.Thread(target=cls.server.run, daemon=True)
        cls.thread.start()
        deadline = time.monotonic() + 5
        while not hasattr(cls.server, 'server_port') and cls.thread.is_alive():
            if time.monotonic() > deadline:
                raise RuntimeError('HTTP server did not start')
            time.sleep(0.01)
        if not cls.thread.is_alive():
            raise RuntimeError('HTTP server exited at startup')
        cls.addClassCleanup(cls.stop_server)

    @classmethod
    def stop_server(cls):
        cls.server.shutdown()
        cls.thread.join(5)
        cls.server.server_close()

    def request(self, path, method='GET'):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        try:
            connection.request(method, path)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_root_listing(self):
        status, _, body = self.request('/user/')
        self.assertEqual(status, 200)
        self.assertIn(b'href="docs/"', body)

    def test_nested_listing_escapes_and_quotes_names(self):
        status, _, body = self.request('/user/docs/')
        self.assertEqual(status, 200)
        self.assertIn(b'href="space%20%26%20name.txt"', body)
        self.assertIn(b'space &amp; name.txt', body)

    def test_html_index_precedes_htm(self):
        status, _, body = self.request('/user/site/')
        self.assertEqual((status, body), (200, b'<p>HTML index</p>'))

    def test_htm_index(self):
        status, _, body = self.request('/user/short/')
        self.assertEqual((status, body), (200, b'<p>Short index</p>'))

    def test_directory_redirect_preserves_query(self):
        status, headers, _ = self.request('/user/docs?download=1')
        self.assertEqual(status, 301)
        self.assertEqual(headers['Location'], '/user/docs/?download=1')

    def test_root_redirect(self):
        status, headers, _ = self.request('/user')
        self.assertEqual(status, 301)
        self.assertEqual(headers['Location'], '/user/')

    def test_regular_file_and_encoded_name(self):
        for path, content in [('manual.txt', b'Boat manual'), ('space%20%26%20name.txt', b'Encoded name')]:
            with self.subTest(path=path):
                status, _, body = self.request('/user/docs/' + path)
                self.assertEqual((status, body), (200, content))

    def test_head_has_same_length_without_body(self):
        for path in ['/user/docs/', '/user/site/', '/user/docs/manual.txt']:
            with self.subTest(path=path):
                status, headers, body = self.request(path)
                head_status, head_headers, head_body = self.request(path, 'HEAD')
                self.assertEqual(status, 200)
                self.assertEqual(head_status, status)
                self.assertEqual(head_headers['Content-Length'], str(len(body)))
                self.assertEqual(head_body, b'')

    def test_existing_handlers_and_icon_fallback(self):
        for path, content in [('/user/viewer/user.css', b'body { color: blue; }'),
                              ('/user/images/boat.svg', b'<svg>boat</svg>'),
                              ('/user/icons/old.svg', b'<svg>old</svg>'),
                              ('/user/icons/boat.svg', b'<svg>boat</svg>'),
                              ('/viewer/main.html', b'<p>Viewer</p>')]:
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual((status, body), (200, content))

    def test_configured_user_directory_is_used(self):
        mapped = Path(self.temp.name) / 'custom-user'
        mapped.mkdir()
        (mapped / 'mapped.txt').write_text('Custom directory')
        previous = self.server.pathmappings['user']
        try:
            self.server.updatePathMappings({'user': str(mapped)})
            status, _, body = self.request('/user/mapped.txt')
            self.assertEqual((status, body), (200, b'Custom directory'))
            self.assertEqual(self.request('/user/docs/manual.txt')[0], 404)
        finally:
            self.server.updatePathMappings({'user': previous})

    def test_invalid_or_unmapped_paths_are_not_served(self):
        for path in ['/user/missing.txt', '/users/docs/manual.txt', '/private.txt',
                     '/user/../private.txt', '/user/%2e%2e/private.txt']:
            with self.subTest(path=path):
                status, _, _ = self.request(path)
                self.assertEqual(status, 404)


if __name__ == '__main__':
    unittest.main()
