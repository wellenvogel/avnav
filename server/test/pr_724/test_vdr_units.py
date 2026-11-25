"""Regression for https://github.com/wellenvogel/avnav/issues/722.

Run with: python3 -m unittest discover -s server/test/pr_vdr_units -v
"""
import sys
import unittest
from functools import reduce
from operator import xor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from avnav_nmea import NMEAParser
from avnav_store import AVNStore


class VdrUnitsTest(unittest.TestCase):
    def setUp(self):
        self.store = AVNStore(60, 60, "")
        NMEAParser.registerKeys(self.store)
        self.parser = NMEAParser(self.store)

    def parse(self, payload):
        checksum = reduce(xor, payload.encode("ascii"), 0)
        self.assertTrue(self.parser.parseData("$%s*%02X" % (payload, checksum)))

    def test_drift_is_metres_per_second(self):
        for knots in (0, 0.5, 2, 12.3):
            with self.subTest(knots=knots):
                self.parse("IIVDR,123.0,T,120.0,M,%s,N" % knots)
                self.assertAlmostEqual(self.store.getSingleValue("gps.currentDrift"),
                                       knots * 1852 / 3600)
                self.assertEqual(self.store.getSingleValue("gps.currentSet"), 123)

    def test_missing_drift_keeps_direction(self):
        self.parse("IIVDR,123.0,T,120.0,M,,N")
        self.assertEqual(self.store.getSingleValue("gps.currentSet"), 123)
        self.assertIsNone(self.store.getSingleValue("gps.currentDrift"))

    def test_drift_without_direction(self):
        self.parse("IIVDR,,T,,M,2.0,N")
        self.assertAlmostEqual(self.store.getSingleValue("gps.currentDrift"), 1852 / 1800)
        self.assertIsNone(self.store.getSingleValue("gps.currentSet"))

    def test_other_speed_unit_is_not_treated_as_knots(self):
        self.parse("IIVDR,123.0,T,120.0,M,2.0,K")
        self.assertIsNone(self.store.getSingleValue("gps.currentDrift"))


if __name__ == "__main__":
    unittest.main()
