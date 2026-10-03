"""Prepare noncommercial ACL2022 GTL comment-mention research data.

No production weights/data are generated. SGF comments are weak labels, not
truth of concept presence. Only mainline move nodes are aligned after the move.
Run: python scripts/experiments/prepare_comment_concepts.py --games 1000
Requires sgfmill (compatible with 1.1.0/1.1.1); caches original SGFs and provenance under .tmp/concept-data.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import urllib.request
from collections import Counter
from sgfmill import sgf, boards

REPO = 'https://github.com/AndreHe02/go'
DEFAULT_REVISION = 'ad7c6bfab21fcd59650db28efe57df0d4531317d'
CONCEPTS = ['atari', 'ko', 'ladder', 'eye', 'cut', 'wall', 'sente', 'gote',
            'shape', 'influence', 'territory', 'joseki', 'tesuji', 'pincer',
            'attack', 'defend', 'invasion', 'life_death', 'connect', 'life', 'death', 'thick', 'weak', 'sacrifice']
PATTERNS = {
    'attack': r'attack(?:s|ed|ing)?', 'defend': r'(?:defend(?:s|ed|ing)?|defen[cs]e)',
    'invasion': r'(?:invasions?|invad(?:e|es|ed|ing))',
    'life_death': r'(?:life|death|alive|dead|live|die|dying)',
    'eye': r'eyes?', 'cut': r'cut(?:s|ting)?', 'wall': r'walls?',
    'connect': r'connect(?:s|ed|ing|ion|ions)?',
    'thick': r'thick(?:ness)?', 'weak': r'weak(?:ness)?',
}

def fetch(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        return response.read()

def gtp(point, size):
    if point is None:
        return 'pass'
    row, col = point
    return 'ABCDEFGHJKLMNOPQRSTUVXYZ'[col] + str(row + 1)

def flat(board):
    return [1 if board.get(row, col) == 'b' else -1 if board.get(row, col) == 'w' else 0
            for row in range(board.side) for col in range(board.side)]

def canonical_game_key(game):
    root = game.get_root()
    black, white, empty = root.get_setup_stones()
    initial = [['B', list(x)] for x in sorted(black)] + [['W', list(x)] for x in sorted(white)]
    moves = [[color, point] for node in game.get_main_sequence()
             for color, point in [node.get_move()] if color is not None]
    # Excludes comments and metadata so reannotated copies of one game stay together.
    payload = json.dumps([game.get_size(), initial, moves], separators=(',', ':'))
    return hashlib.sha256(payload.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--games', type=int, default=1000)
    parser.add_argument('--revision', default=DEFAULT_REVISION,
                        help='Pinned full Git revision SHA for the annotation data')
    parser.add_argument('--output', type=Path, default=Path('.tmp/concept-data'))
    args = parser.parse_args()
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    revision = args.revision.lower()
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        parser.error('--revision must be a full 40-character Git revision SHA')
    tree_path = out / ('upstream-tree-' + revision + '.json')
    if tree_path.exists():
        tree = json.loads(tree_path.read_text(encoding='utf-8'))
    else:
        # The old unversioned master cache is deliberately never reused.
        tree = json.loads(fetch('https://api.github.com/repos/AndreHe02/go/git/trees/' +
                                revision + '?recursive=1'))
    if tree.get('sha') != revision:
        raise ValueError('Git tree SHA does not match requested revision: ' +
                         str(tree.get('sha')) + ' != ' + revision)
    if tree.get('truncated'):
        raise ValueError('Refusing a truncated Git tree listing')
    if not tree_path.exists():
        tree_path.write_text(json.dumps(tree, indent=2), encoding='utf-8')
    blob_hashes = {x['path']: x['sha'] for x in tree['tree'] if x['type'] == 'blob'}
    paths = sorted((x['path'] for x in tree['tree'] if x['type'] == 'blob' and
                    x['path'].startswith('data/annotations/')),
                   key=lambda path: int(Path(path).stem))[:args.games]
    base = 'https://raw.githubusercontent.com/AndreHe02/go/' + revision + '/'
    def download(path):
        dest = out / 'acl2022' / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        def valid_blob(data):
            header = ('blob ' + str(len(data)) + '\0').encode()
            return hashlib.sha1(header + data).hexdigest() == blob_hashes[path]
        if not dest.exists() or not valid_blob(dest.read_bytes()):
            data = fetch(base + path)
            if not valid_blob(data):
                raise ValueError('Downloaded SGF blob does not match pinned revision: ' + path)
            dest.write_bytes(data)
        return dest
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        files = list(executor.map(download, paths))
    stats = Counter()
    positives = Counter()
    split_games = {x: set() for x in ['train', 'val', 'test']}
    errors = []
    seen = set()
    with (out / 'comments.jsonl').open('w', encoding='utf-8') as writer:
        for path in files:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in seen:
                stats['duplicate_games'] += 1
                continue
            seen.add(digest)
            try:
                game = sgf.Sgf_game.from_bytes(path.read_bytes())
                source_game_key = canonical_game_key(game)
                bucket = int(source_game_key[:8], 16) % 10
                split = 'test' if bucket == 0 else 'val' if bucket == 1 else 'train'
                size = game.get_size()
                if size != 19:
                    stats['non_19_games'] += 1
                    continue
                board = boards.Board(size)
                root = game.get_root()
                black, white, empty = root.get_setup_stones()
                board.apply_setup(black, white, empty)
                initial = [['B', gtp(x, size)] for x in sorted(black)] + [['W', gtp(x, size)] for x in sorted(white)]
                moves = []
                for index, node in enumerate(game.get_main_sequence()):
                    if index and any(node.has_property(p) for p in ['AB', 'AW', 'AE']):
                        stats['midgame_setup_truncated'] += 1
                        break
                    color, point = node.get_move()
                    if color is None:
                        if node.has_property('C'):
                            stats['nonmove_comments_excluded'] += 1
                        continue
                    before = flat(board)
                    moves_before = list(moves)
                    if point is not None:
                        board.play(*point, color)
                    move = [color.upper(), gtp(point, size)]
                    moves.append(move)
                    if not node.has_property('C'):
                        continue
                    comment = node.get('C').strip()
                    if len(comment) < 15:
                        stats['short_comments_excluded'] += 1
                        continue
                    labels = {word: int(bool(re.search(r'\b(?:' + PATTERNS.get(word, re.escape(word)) + r')\b', comment, re.I)))
                              for word in CONCEPTS}
                    positives.update({k: v for k, v in labels.items() if v})
                    sample = dict(sample_id=path.stem + ':' + str(index), game_id=path.stem,
                        game_sha256=source_game_key, source_game_key=source_game_key, file_sha256=digest, split=split, board_size=size,
                        board_before=before, board_after=flat(board), initial_stones=initial,
                        moves_before=moves_before, moves_after=list(moves), played_move=move,
                        to_play_after='W' if color == 'b' else 'B', comment=comment, labels=labels,
                        alignment='comment_on_sgf_move_node_after_play',
                        komi=game.get_komi(), rules=root.get('RU') if root.has_property('RU') else None)
                    writer.write(json.dumps(sample, ensure_ascii=False) + '\n')
                    stats['samples'] += 1
                    stats['samples_' + split] += 1
                    split_games[split].add(source_game_key)
                stats['parsed_19_games'] += 1
            except Exception as exc:
                errors.append({'game': path.stem, 'error': type(exc).__name__ + ': ' + str(exc)})
    summary = dict(repo=REPO, commit=revision, requested_games=args.games,
        selection='first numeric game ids', downloaded_games=len(files), counts=dict(stats),
        split_games={k: len(v) for k, v in split_games.items()}, label_positives=dict(positives),
        concepts=CONCEPTS, errors=errors, coordinate_system='row0 bottom, col0 left; index=row*19+col',
        permission='GTL non-commercial digital redistribution; research only; do not redistribute production weights',
        source_paper='https://aclanthology.org/2022.acl-short.90/',
        label_warning='Mention labels only: hypotheticals, negation, alternative lines and omissions cause noise.')
    (out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: summary[k] for k in ['downloaded_games', 'counts', 'split_games', 'label_positives']}, indent=2))

if __name__ == '__main__':
    main()
