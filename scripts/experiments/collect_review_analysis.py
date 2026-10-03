"""Collect ordinary KataGo before/after evidence without disclosing review text.

The .anonymous.json sibling is the only payload intended for an LLM. The main
output contains local case mapping and reproducibility information.
"""
import argparse
import copy
import json
import math
from pathlib import Path
import queue
import subprocess
import threading
import time

from collect_katago_concepts import normalized_rules, sha


LIMITATION = ('PV is a searched continuation, not proof of player intent. '
              'Unknown or missing source rules use a Japanese fallback; '
              '128 visits and external model evidence do not establish concept truth.')


def build_requests(row, anonymous_id, visits=128, ownership=False):
    """Whitelist engine fields and require the exact played-move history delta."""
    before, after = row['moves_before'], row['moves_after']
    played = row['played_move']
    if after != before + [played]:
        raise ValueError('moves_after must equal moves_before plus played_move')
    size = row['board_size']
    if not isinstance(size, int) or isinstance(size, bool) or not 2 <= size <= 25:
        raise ValueError('invalid board_size')
    komi = float(row['komi'])
    if not math.isfinite(komi):
        raise ValueError('invalid komi')
    rules, fallback = normalized_rules(row.get('rules'))
    base = {'boardXSize': size, 'boardYSize': size, 'rules': rules, 'komi': komi,
            'initialStones': copy.deepcopy(row['initial_stones']),
            'maxVisits': visits, 'includeOwnership': ownership,
            'overrideSettings': {'reportAnalysisWinratesAs': 'BLACK'}}
    requests = {}
    for phase, moves in (('pre', before), ('post', after)):
        requests[phase] = dict(copy.deepcopy(base), id=f'{anonymous_id}-{phase}',
                               moves=copy.deepcopy(moves))
    return requests, fallback


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_result(result, request):
    if result.get('id') != request['id']:
        raise ValueError('unexpected response id')
    if result.get('error'):
        raise ValueError('KataGo: ' + str(result['error']))
    root = result.get('rootInfo')
    moves = result.get('moveInfos')
    if not isinstance(root, dict) or not isinstance(moves, list) or not moves:
        raise ValueError('missing rootInfo or moveInfos')
    for info in [root] + moves[:5]:
        for field in ('visits', 'winrate', 'scoreLead'):
            if not finite_number(info.get(field)):
                raise ValueError('missing or nonfinite ' + field)
        if not 0 <= info['winrate'] <= 1 or info['visits'] <= 0:
            raise ValueError('invalid winrate or visits')
    for move in moves[:5]:
        if not isinstance(move.get('move'), str) or not isinstance(move.get('pv'), list) or not move['pv']:
            raise ValueError('missing move or PV')
        if move['pv'][0] != move['move'] or not all(isinstance(p, str) for p in move['pv']):
            raise ValueError('PV does not begin at candidate move')
    evidence = {'rootInfo': root, 'moveInfos': moves[:5], 'perspective': 'BLACK'}
    if 'ownership' in result or request['includeOwnership']:
        own = result.get('ownership')
        expected = request['boardXSize'] * request['boardYSize']
        if not isinstance(own, list) or len(own) != expected or not all(
                finite_number(v) and -1 <= v <= 1 for v in own):
            raise ValueError('missing or invalid ownership')
        evidence['ownership'] = own
    return evidence


def anonymous_case(anonymous_id, requests, analyses, fallback):
    positions = {}
    for phase, request in requests.items():
        positions[phase] = {key: copy.deepcopy(request[key]) for key in
                           ('boardXSize', 'boardYSize', 'rules', 'komi', 'initialStones', 'moves')}
    return {'id': anonymous_id, 'positions': positions, 'rules_fallback': fallback,
            'played_move': requests['post']['moves'][-1], 'analysis': analyses}


class Engine:
    def __init__(self, binary, model, config, log_path):
        self.log = open(log_path, 'w', encoding='utf-8')
        try:
            self.proc = subprocess.Popen([binary, 'analysis', '-model', model, '-config', config],
                                         stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=self.log, text=True, bufsize=1)
        except Exception:
            self.log.close()
            raise
        self.responses = queue.Queue()
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read(self):
        for line in self.proc.stdout:
            try:
                self.responses.put(json.loads(line))
            except json.JSONDecodeError:
                self.responses.put({'error': 'non-JSON engine output'})
        self.responses.put({'error': 'KataGo stdout closed'})

    def query(self, request, timeout):
        start = time.monotonic()
        self.proc.stdin.write(json.dumps(request, allow_nan=False) + '\n')
        self.proc.stdin.flush()
        while True:
            remaining = timeout - (time.monotonic() - start)
            if remaining <= 0:
                raise TimeoutError('analysis timeout')
            try:
                result = self.responses.get(timeout=remaining)
            except queue.Empty as exc:
                raise TimeoutError('analysis timeout') from exc
            if result.get('error'):
                raise RuntimeError(str(result['error']))
            if result.get('id') != request['id']:
                raise RuntimeError('unexpected engine response id')
            if result.get('isDuringSearch'):
                continue
            evidence = validate_result(result, request)
            evidence['elapsed_seconds'] = time.monotonic() - start
            return evidence

    def close(self):
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait()
        self.reader.join(timeout=2)
        self.proc.stdin.close()
        self.proc.stdout.close()
        self.log.close()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('data', 'cases', 'binary', 'model', 'config', 'out'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--visits', type=int, default=128)
    parser.add_argument('--timeout', type=float, default=120)
    parser.add_argument('--ownership', action='store_true')
    args = parser.parse_args()
    if args.visits <= 0 or args.timeout <= 0:
        parser.error('visits and timeout must be positive')
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    rows = {r['sample_id']: r for r in (json.loads(line) for line in
            Path(args.data).read_text(encoding='utf-8').splitlines() if line.strip())}
    cases = json.loads(Path(args.cases).read_text(encoding='utf-8'))['cases']
    version = subprocess.run([args.binary, 'version'], capture_output=True, text=True, timeout=30, check=True)
    local = {'metadata': {'version': version.stdout.strip(), 'perspective': 'BLACK',
             'maxVisits': args.visits, 'binary_sha256': sha(args.binary),
             'model_sha256': sha(args.model), 'config_sha256': sha(args.config),
             'data_sha256': sha(args.data), 'cases_sha256': sha(args.cases),
             'case_order': 'input cases array order', 'limitation': LIMITATION}, 'cases': []}
    anon = {'perspective': 'BLACK', 'maxVisits': args.visits, 'limitation': LIMITATION, 'cases': []}
    anon_path = out.with_name(out.stem + '.anonymous.json')
    start = time.monotonic()
    engine = Engine(args.binary, args.model, args.config, str(out) + '.stderr.log')
    failed = False
    try:
        for index, case in enumerate(cases, 1):
            anonymous_id = f'position-{index:02d}'
            record = {'local_case_id': case['id'], 'anonymous_id': anonymous_id}
            local['cases'].append(record)
            try:
                row = rows[case['id']]
                requests, fallback = build_requests(row, anonymous_id, args.visits, args.ownership)
                if row['played_move'] != [case['playerColor'], case['playedMove']]:
                    raise ValueError('case played move disagrees with source history')
                record.update(requests=requests, rules_source=row.get('rules'), rules_fallback=fallback)
                record['analysis'] = {}
                for phase, request in requests.items():
                    record['analysis'][phase] = engine.query(request, args.timeout)
                record['status'] = 'ok'
                anon['cases'].append(anonymous_case(anonymous_id, requests, record['analysis'], fallback))
            except (KeyError, ValueError, RuntimeError, TimeoutError, OSError) as exc:
                record.update(status='error', error=str(exc))
                failed = True
            write_json(out, local)
            write_json(anon_path, anon)
            print(f'{index}/{len(cases)} {anonymous_id} {record["status"]}', flush=True)
            if failed:
                break
    finally:
        engine.close()
        local['summary'] = {'requested': len(cases), 'succeeded': len(anon['cases']),
                            'elapsed_seconds': time.monotonic() - start,
                            'status': 'error' if failed else 'ok'}
        write_json(out, local)
        write_json(anon_path, anon)
    print(json.dumps(local['summary']), flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
