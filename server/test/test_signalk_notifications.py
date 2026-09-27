"""Notification regressions: python -m unittest discover -s server/test -p test_signalk_notifications.py

Uses the bundled libraries and the server's pyserial dependency. No server,
websocket connection or alarm command thread is started.
"""
import datetime
import os
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
for directory in ('libraries', 'server', 'server/handler'):
    sys.path.insert(0, os.path.join(ROOT, directory))

from alarmhandler import AVNAlarmHandler
from signalkhandler import AVNSignalKHandler, Config, SKAlarm


class NotificationTest(unittest.TestCase):
    PATHS = ('notifications.navigation.anchor', 'notifications.stowage.stock')

    def setUp(self):
        self.handler = AVNSignalKHandler({})
        self.handler.config = Config({
            'uuid': 'test', 'sendData': True,
            'receiveNotifications': True, 'sendNotifications': True,
        })
        self.handler.navdata = Mock()
        self.handler.navdata.getExpiryPeriod.return_value = 60
        self.alarms = AVNAlarmHandler({})
        self.alarms.navdata = Mock()
        self.alarms.getSoundFile = Mock(return_value=None)
        self.handler.alarmhandler = self.alarms
        for alarms in (self.handler.deltas, self.handler.deleteAndActivateActions):
            alarms.setParam(self.handler.config.skSource, self.handler.config.remoteId)
        self.now = datetime.datetime.now(datetime.timezone.utc)
        # The websocket callback catches errors; make swallowed exceptions fail tests.
        error_patch = patch('signalkhandler.AVNLog.error')
        self.errors = error_patch.start()
        self.addCleanup(error_patch.stop)
        self.addCleanup(self.errors.assert_not_called)

    def value(self, state):
        if state is None:
            return None
        return {'state': state, 'message': 'Plugin restarted', 'method': ['sound']}

    def receive(self, transport, state, path=PATHS[0], age=0, source='plugin'):
        timestamp = (self.now - datetime.timedelta(seconds=age)).strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        value = self.value(state)
        if transport == 'full':
            node = {'value': value, 'timestamp': timestamp, '$source': source}
            for part in reversed(path.split('.')):
                node = {part: node}
            self.handler.storeData(node, self.handler.config.priority)
        else:
            self.handler.webSocketMessage({'updates': [{
                '$source': source, 'timestamp': timestamp,
                'values': [{'path': path, 'value': value}],
            }]}, None, False)

    def test_inactive_values(self):
        for state in (None, 'normal'):
            with self.subTest(state=state):
                alarm = SKAlarm(SKAlarm.T_RECV, self.PATHS[0], 'plugin', self.value(state))
                self.assertFalse(alarm.isInState(True))
                self.assertTrue(alarm.isInState(False))

    def test_other_values_keep_existing_semantics(self):
        for value in ({}, {'message': 'legacy'}, {'state': 'unknown'},
                      *[self.value(s) for s in ('alert', 'warn', 'alarm', 'emergency')]):
            with self.subTest(value=value):
                alarm = SKAlarm(SKAlarm.T_RECV, self.PATHS[0], 'plugin', value)
                self.assertTrue(alarm.isInState(True))
                self.assertFalse(alarm.isInState(False))

    def test_normal_does_not_start_mapped_or_generic_alarm(self):
        for transport in ('full', 'delta'):
            for path in self.PATHS:
                with self.subTest(transport=transport, path=path):
                    self.receive(transport, 'normal', path)
                    self.assertEqual(self.alarms.getRunningAlarmNames(), [])
                    self.assertEqual(self.handler.deleteAndActivateActions.skList, {})

    def test_active_notifications_start_mapped_and_generic_alarms(self):
        for transport in ('full', 'delta'):
            for path, name in zip(self.PATHS, ('anchor', 'sk:stowage.stock')):
                for state in ('alert', 'warn', 'alarm', 'emergency'):
                    with self.subTest(transport=transport, path=path, state=state):
                        self.handler.deltas.clear()
                        self.receive(transport, state, path)
                        self.assertTrue(self.alarms.isAlarmActive(name))
                        self.alarms.stopAlarm(name)

    def test_normal_and_null_clear_imported_alarms(self):
        for transport in ('full', 'delta'):
            for path, name in zip(self.PATHS, ('anchor', 'sk:stowage.stock')):
                for state in ('normal', None):
                    with self.subTest(transport=transport, path=path, state=state):
                        self.handler.deltas.clear()
                        self.receive(transport, 'alarm', path, age=1)
                        self.assertTrue(self.alarms.isAlarmActive(name))
                        self.receive(transport, state, path)
                        self.assertFalse(self.alarms.isAlarmActive(name))

    def test_newer_normal_delta_wins_over_stale_active_full(self):
        self.receive('delta', 'normal')
        self.receive('full', 'alarm', age=1)
        self.assertFalse(self.alarms.isAlarmActive('anchor'))

    def test_newer_active_delta_wins_over_stale_normal_full(self):
        self.receive('delta', 'alarm')
        self.receive('full', 'normal', age=1)
        self.assertTrue(self.alarms.isAlarmActive('anchor'))

    def test_equal_timestamp_retains_normal_delta_during_resync(self):
        self.receive('delta', 'normal')
        # Freeze conversion so the test exercises exactly equal monotonic timestamps.
        timestamp = self.handler.deltas.skList[self.PATHS[0]].timestamp
        with patch.object(self.handler, 'timestampToMonotonic', return_value=timestamp):
            self.receive('full', 'alarm')
        self.assertFalse(self.alarms.isAlarmActive('anchor'))

    def test_full_normal_preserves_local_alarm_and_queues_resend(self):
        self.alarms.startAlarm('anchor')
        self.receive('full', 'normal')
        self.assertTrue(self.alarms.isAlarmActive('anchor', True))
        action = self.handler.deleteAndActivateActions.skList[self.PATHS[0]]
        self.assertTrue(action.shouldSend)
        self.assertTrue(action.isInState(True))

    def test_other_normal_delta_clears_local_alarm(self):
        self.alarms.startAlarm('anchor')
        self.receive('delta', 'normal')
        self.assertFalse(self.alarms.isAlarmActive('anchor'))

    def test_own_normal_does_not_queue_redundant_delete(self):
        for transport in ('full', 'delta'):
            with self.subTest(transport=transport):
                self.receive(transport, 'normal', source='local.' + self.handler.config.skSource)
                self.assertEqual(self.handler.deleteAndActivateActions.skList, {})

    def test_own_normal_preserves_local_alarm_and_queues_resend(self):
        self.alarms.startAlarm('anchor')
        self.receive('full', 'normal', source='local.' + self.handler.config.skSource)
        self.assertTrue(self.alarms.isAlarmActive('anchor', True))
        action = self.handler.deleteAndActivateActions.skList[self.PATHS[0]]
        self.assertTrue(action.shouldSend)
        self.assertTrue(action.isInState(True))


if __name__ == '__main__':
    unittest.main()
