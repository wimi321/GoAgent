import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch
import queue

EXPERIMENTS = Path(__file__).resolve().parents[1] / 'experiments'
sys.path.insert(0, str(EXPERIMENTS))
import collect_review_analysis as collector


class ReviewAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.row = {'sample_id': 'SECRET-ID', 'comment': 'SECRET-COMMENT',
                    'metadata': {'secret': True}, 'labels': {'attack': 1},
                    'feedback': 'SECRET-FEEDBACK', 'source': 'SECRET-SOURCE',
                    'board_size': 19, 'komi': 6, 'rules': None,
                    'initial_stones': [['B', 'D4']], 'moves_before': [['W', 'Q16']],
                    'moves_after': [['W', 'Q16'], ['B', 'D16']], 'played_move': ['B', 'D16']}

    def test_requests_are_whitelisted_and_anonymous(self):
        requests, fallback = collector.build_requests(self.row, 'position-01')
        self.assertEqual(requests['pre']['id'], 'position-01-pre')
        self.assertEqual(requests['post']['id'], 'position-01-post')
        self.assertNotIn('SECRET', json.dumps(requests))
        self.assertEqual(set(requests['pre']), {'id', 'boardXSize', 'boardYSize', 'rules',
                         'komi', 'initialStones', 'maxVisits', 'includeOwnership', 'overrideSettings', 'moves'})
        self.assertEqual(requests['pre']['maxVisits'], 128)
        self.assertEqual(requests['pre']['overrideSettings'], {'reportAnalysisWinratesAs': 'BLACK'})
        self.assertIn('Japanese fallback', fallback)

    def test_before_after_preserve_real_history_and_setup(self):
        requests, _ = collector.build_requests(self.row, 'position-01')
        self.assertEqual(requests['pre']['moves'], self.row['moves_before'])
        self.assertEqual(requests['post']['moves'], self.row['moves_after'])
        self.assertEqual(requests['pre']['initialStones'], self.row['initial_stones'])
        self.assertEqual(requests['pre']['komi'], 6)
        requests['pre']['moves'].append(['W', 'A1'])
        self.assertEqual(len(self.row['moves_before']), 1)
        self.assertEqual(len(requests['post']['moves']), 2)

    def test_rejects_wrong_history_timepoint(self):
        self.row['moves_after'] = self.row['moves_before']
        with self.assertRaisesRegex(ValueError, 'plus played_move'):
            collector.build_requests(self.row, 'position-01')

    def test_known_rules_preserved(self):
        self.row['rules'] = 'Chinese'
        requests, fallback = collector.build_requests(self.row, 'position-01')
        self.assertEqual(requests['pre']['rules'], 'chinese')
        self.assertIsNone(fallback)

    def test_anonymous_export_does_not_copy_source_fields(self):
        requests, fallback = collector.build_requests(self.row, 'position-01')
        payload = collector.anonymous_case('position-01', requests, {}, fallback)
        text = json.dumps(payload)
        self.assertNotIn('SECRET', text)
        for field in ('local_case_id', 'sample_id', 'source', 'labels', 'comment', 'metadata', 'feedback'):
            self.assertNotIn(field, payload)
        self.assertEqual(payload['positions']['pre']['moves'], self.row['moves_before'])
        self.assertEqual(payload['positions']['post']['moves'], self.row['moves_after'])

    def test_result_validation_and_optional_ownership(self):
        requests, _ = collector.build_requests(self.row, 'position-01', ownership=True)
        result = {'id': requests['pre']['id'],
                  'rootInfo': {'visits': 128, 'winrate': .5, 'scoreLead': -1},
                  'moveInfos': [{'move': 'D16', 'pv': ['D16', 'Q4'], 'visits': 80,
                                 'winrate': .51, 'scoreLead': -.2}], 'ownership': [0.] * 361}
        self.assertEqual(collector.validate_result(result, requests['pre'])['rootInfo']['visits'], 128)
        for bad in (None, [0.] * 360, [float('nan')] * 361, [2.] * 361, [False] * 361):
            result['ownership'] = bad
            with self.assertRaises(ValueError):
                collector.validate_result(result, requests['pre'])
        result['ownership'] = [0.] * 361
        del result['rootInfo']['scoreLead']
        with self.assertRaises(ValueError):
            collector.validate_result(result, requests['pre'])

    def test_query_sends_anonymous_request_and_measures_response_time(self):
        requests, _ = collector.build_requests(self.row, 'position-01')
        request = requests['pre']
        result = {'id': request['id'], 'rootInfo': {'visits': 128, 'winrate': .5, 'scoreLead': 1},
                  'moveInfos': [{'move': 'D16', 'pv': ['D16'], 'visits': 128,
                                 'winrate': .5, 'scoreLead': 1}]}
        engine = collector.Engine.__new__(collector.Engine)
        engine.proc = Mock()
        engine.responses = queue.Queue()
        engine.responses.put(dict(result, isDuringSearch=True))
        engine.responses.put(result)
        with patch.object(collector.time, 'monotonic', side_effect=[10., 10.1, 10.2, 10.7]):
            evidence = engine.query(request, 120)
        sent = json.loads(engine.proc.stdin.write.call_args.args[0])
        self.assertEqual(sent, request)
        self.assertNotIn('SECRET', json.dumps(sent))
        self.assertAlmostEqual(evidence['elapsed_seconds'], .7)

    def test_engine_error_raises_instead_of_fabricating_evidence(self):
        requests, _ = collector.build_requests(self.row, 'position-01')
        engine = collector.Engine.__new__(collector.Engine)
        engine.proc = Mock()
        engine.responses = queue.Queue()
        engine.responses.put({'id': requests['pre']['id'], 'error': 'illegal move'})
        with self.assertRaisesRegex(RuntimeError, 'illegal move'):
            engine.query(requests['pre'], 120)


if __name__ == '__main__':
    unittest.main()
