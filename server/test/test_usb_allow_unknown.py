"""Regression for #683: PYTHONPATH=server:server/handler python3 -m unittest discover -s server/test -p test_usb_allow_unknown.py -v."""
import os
import threading
import time
import unittest
from unittest.mock import patch

import serial
from avnav_worker import UsedResource, WorkerStatus
from avnqueue import AVNQueue
from avnusb import AVNUsbSerialReader, UsbSerialHandler


@unittest.skipUnless(os.name == 'posix', 'uses a local pseudo-terminal')
class UsbAllowUnknownTest(unittest.TestCase):
    def setUp(self):
        import pty
        self.master, self.slave = pty.openpty()
        self.addCleanup(os.close, self.master)
        self.addCleanup(os.close, self.slave)
        self.port = os.ttyname(self.slave)
        self.usbid = 'test-usb:1.0'
        self.opened = threading.Event()
        self.opens = []
        original = serial.Serial

        def open_port(*args, **kwargs):
            device = original(*args, **kwargs)
            self.opens.append(device)
            self.opened.set()
            return device

        self.serial_patch = patch('avnserial.serial.Serial', side_effect=open_port)
        self.serial_patch.start()
        self.addCleanup(self.serial_patch.stop)
        self.env_patch = patch.dict(os.environ, {'AVNAV_ADDSERIAL': self.port})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def start_reader(self, allow_unknown='False', configured_type=None):
        params = dict(allowUnknown=allow_unknown, maxDevices=5, timeout=0.05,
                      minbaud=0, baud=115200)
        if configured_type is not None:
            params['UsbDevice'] = [dict(usbid=self.usbid, type=configured_type)]
        self.reader = AVNUsbSerialReader(params)
        self.reader.queue = AVNQueue({})
        self.addCleanup(self.stop_reader)
        self.reader.checkDevices({self.usbid: self.port})
        return self.reader.addrmap[self.usbid]

    def stop_reader(self):
        handler = self.reader.addrmap.get(self.usbid)
        self.reader.stopHandler(self.usbid)
        deadline = time.monotonic() + 3
        while handler is not None and handler.isRunning and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertFalse(handler is not None and handler.isRunning, 'USB worker did not stop')
        for device in self.opens:
            self.assertFalse(device.is_open, 'Serial port was left open')

    def wait_for_decision(self):
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            status = self.reader.status.get(self.usbid)
            if self.opened.is_set() or (status is not None and status.status == WorkerStatus.INACTIVE):
                return
            time.sleep(0.01)
        self.fail('USB worker did not classify device')

    def test_disabled_unknown_is_visible_but_never_opened(self):
        handler = self.start_reader()
        self.wait_for_decision()
        self.assertEqual(handler.type, UsbSerialHandler.T_UNKNOWN)
        self.assertFalse(self.opened.is_set())
        self.assertIsNone(handler.serialHandler)
        status = self.reader.status[self.usbid]
        self.assertEqual(status.status, WorkerStatus.INACTIVE)
        self.assertIn('forbidden', status.info)
        # A second discovery pass must not turn it into a reader.
        self.reader.checkDevices({self.usbid: self.port})
        self.assertIs(self.reader.addrmap[self.usbid], handler)

    def test_disabled_unknown_does_not_reserve_resources(self):
        self.start_reader()
        self.wait_for_decision()
        self.assertEqual(self.reader.getUsedResources(UsedResource.T_SERIAL), [])
        self.assertEqual(self.reader.getUsedResources(UsedResource.T_USB), [])

    def test_allowed_unknown_still_opens_port(self):
        handler = self.start_reader(allow_unknown='True')
        self.assertTrue(self.opened.wait(3))
        self.assertEqual(handler.type, UsbSerialHandler.T_READER)
        self.assertEqual(len(self.reader.getUsedResources(UsedResource.T_SERIAL)), 1)

    def test_explicit_reader_still_opens_with_unknown_disabled(self):
        handler = self.start_reader(configured_type='reader')
        self.assertTrue(self.opened.wait(3))
        self.assertEqual(handler.type, UsbSerialHandler.T_READER)

    def test_explicit_ignore_still_leaves_port_alone(self):
        handler = self.start_reader(allow_unknown='True', configured_type='ignore')
        self.wait_for_decision()
        self.assertEqual(handler.type, UsbSerialHandler.T_IGNORE)
        self.assertFalse(self.opened.is_set())
        self.assertEqual(self.reader.getUsedResources(), [])


if __name__ == '__main__':
    unittest.main()
