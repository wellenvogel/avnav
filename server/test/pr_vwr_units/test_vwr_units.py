"""Regression tests for VWR metric wind speed fields."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from avnav_nmea import NMEAParser
from avnav_store import AVNStore


class VwrUnitsTest(unittest.TestCase):
    def setUp(self):
        self.store = AVNStore(60, 60, "")
        NMEAParser.registerKeys(self.store)
        self.parser = NMEAParser(self.store)

    def test_speed_in_metres_per_second(self):
        self.assertTrue(self.parser.parseData("$WIVWR,45.0,R,,N,7.2,M,25.9,K*73"))
        self.assertAlmostEqual(self.store.getSingleValue("gps.windSpeed"), 7.2)

    def test_speed_in_kilometres_per_hour(self):
        self.assertTrue(self.parser.parseData("$WIVWR,45.0,R,,N,,M,18.0,K*5F"))
        self.assertAlmostEqual(self.store.getSingleValue("gps.windSpeed"), 5.0)


if __name__ == "__main__":
    unittest.main()
