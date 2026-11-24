"""Run from the repo root: PYTHONPATH=server:server/handler python3 -m unittest discover -s server/test -p test_plugin_load.py"""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pluginhandler import AVNPluginHandler, WorkerStatus


class PluginLoadTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.handler = AVNPluginHandler({'DATADIR': self.temp.name})

    def load(self, python=None, client=None):
        if python is not None:
            (self.directory / 'plugin.py').write_text(python)
        if client:
            (self.directory / client).write_text('')
        api = self.handler.loadAndPreparePlugin(str(self.directory), 'user-fixture', 'user')
        api.startPluginThread()
        return api, self.handler.status['user-fixture']

    def test_python_import_error_is_preserved(self):
        api, status = self.load('import missing_avnav_test_dependency')
        self.assertEqual(status.status, WorkerStatus.ERROR)
        self.assertIn('missing_avnav_test_dependency', status.info)
        self.assertFalse(api.isActive())

    def test_mixed_plugin_does_not_hide_import_error(self):
        api, status = self.load('import missing_avnav_test_dependency', 'plugin.js')
        self.assertEqual(status.status, WorkerStatus.ERROR)
        self.assertIn('missing_avnav_test_dependency', status.info)
        self.assertFalse(api.jsCssOnly)
        self.assertFalse(api.isActive())

    def test_syntax_error_is_preserved(self):
        api, status = self.load('def broken(:', 'plugin.mjs')
        self.assertEqual(status.status, WorkerStatus.ERROR)
        self.assertIn('invalid syntax', status.info)

    def test_constructor_error_is_preserved(self):
        api, status = self.load('''class Plugin:
    @classmethod
    def pluginInfo(cls): return {}
    def __init__(self, api): raise ValueError("invalid fixture setting")
    def run(self): pass
''')
        self.assertEqual(status.status, WorkerStatus.ERROR)
        self.assertIn('invalid fixture setting', status.info)

    def test_client_only_remains_supported(self):
        for client in ['plugin.js', 'plugin.css', 'plugin.mjs']:
            with self.subTest(client=client):
                api, status = self.load(client=client)
                self.assertTrue(api.jsCssOnly)
                self.assertTrue(api.isActive())
                self.assertEqual(status.status, WorkerStatus.NMEA)
                (self.directory / client).unlink()

    def test_valid_python_plugin_can_start(self):
        with patch('pluginhandler.WorkerThread') as thread:
            api, status = self.load("""class Plugin:
    @classmethod
    def pluginInfo(cls): return {}
    def __init__(self, api): pass
    def run(self): pass
""")
            self.assertTrue(api.isActive())
            self.assertFalse(api.jsCssOnly)
            thread.return_value.start.assert_called_once()

    def test_disabled_failure_remains_disabled(self):
        self.handler.param['user-fixture'] = [{'enabled': 'false'}]
        api, status = self.load('import missing_avnav_test_dependency', 'plugin.js')
        self.assertEqual(status.status, WorkerStatus.INACTIVE)
        self.assertFalse(api.isActive())
        self.handler.param['user-fixture'][0]['enabled'] = 'true'
        api.startPluginThread()
        self.assertEqual(status.status, WorkerStatus.ERROR)
        self.assertIn('missing_avnav_test_dependency', status.info)

    def test_missing_plugin_still_reports_failure(self):
        api, status = self.load()
        self.assertFalse(api.isActive())
        self.assertEqual(status.status, WorkerStatus.ERROR)


if __name__ == '__main__':
    unittest.main()
