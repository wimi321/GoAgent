"""Reproducible comment-keyword prediction; metrics are NOT Go semantic accuracy.

Data and weights must stay local because upstream annotations have noncommercial
licensing. Never substitute rule-generated board labels for comment supervision.
"""
import argparse
import hashlib
import json
from pathlib import Path
import random
import numpy as np
import torch
from torch import nn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, average_precision_score


def read_jsonl(path):
    return [json.loads(s) for s in Path(path).read_text(encoding='utf-8').splitlines() if s.strip()]


def metrics(y, pred, labels, scores=None):
    ap = [float(average_precision_score(y[:,i], scores[:,i])) if y[:,i].sum() else 0.0
          for i in range(len(labels))] if scores is not None else None
    return {'macro_average_precision': float(np.mean(ap)) if ap is not None else None,
            'macro_f1': float(f1_score(y, pred, average='macro', zero_division=0)),
            'macro_precision': float(precision_score(y, pred, average='macro', zero_division=0)),
            'macro_recall': float(recall_score(y, pred, average='macro', zero_division=0)),
            'per_label': {label: {'prevalence': float(y[:, i].mean()),
                                  'f1': float(f1_score(y[:, i], pred[:, i], zero_division=0)),
                                  'precision': float(precision_score(y[:, i], pred[:, i], zero_division=0)),
                                  'recall': float(recall_score(y[:, i], pred[:, i], zero_division=0))}
                          for i, label in enumerate(labels)}}


def select_thresholds(y, probs, balanced):
    if balanced:
        grid = [0.01,0.03,0.05,0.1,0.2,0.3,0.5,0.7,0.9]
        return np.array([max(grid,key=lambda t:f1_score(y[:,j],probs[:,j]>=t,zero_division=0))
                         if y[:,j].sum() else 1.01 for j in range(y.shape[1])])
    grid = [0.1,0.2,0.3,0.5,0.7]
    return max(grid,key=lambda t:f1_score(y,probs>=t,average='macro',zero_division=0))


def threshold_json(t): return t.tolist() if isinstance(t,np.ndarray) else t


def planes(row, feature):
    b = np.asarray(row['board_after']).reshape(19, 19)
    last = np.zeros((19, 19), dtype=np.float32)
    move = row['played_move']
    if isinstance(move, list):
        color, move = move
    else:
        color = row['moves_after'][-1][0]
    if move.lower() != 'pass':
        last[int(move[1:])-1, 'ABCDEFGHJKLMNOPQRST'.index(move[0].upper())] = 1
    result = [(b == 1).astype('float32'), (b == -1).astype('float32'), last,
              np.full((19,19), 1 if color == 'B' else -1, dtype='float32')]
    if feature is not None:
        result.extend([np.asarray(feature['ownership'], dtype='float32').reshape(19,19)[::-1].copy(),
                       np.asarray(feature['policy'][:361], dtype='float32').reshape(19,19)[::-1].copy()])
    return np.stack(result)


class TinyCNN(nn.Module):
    def __init__(self, channels, labels):
        super().__init__()
        self.net = nn.Sequential(nn.Conv2d(channels, 8, 3, padding=1), nn.ReLU(),
                                 nn.Conv2d(8, 8, 3, padding=1), nn.ReLU(),
                                 nn.AdaptiveAvgPool2d((4,4)), nn.Flatten(), nn.Linear(128, labels))
    def forward(self, x):
        return self.net(x)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--data', required=True)
    p.add_argument('--features')
    p.add_argument('--out', required=True)
    p.add_argument('--max-samples', type=int, default=300)
    p.add_argument('--seed', type=int, default=20261002)
    p.add_argument('--epochs', type=int, default=50)
    p.add_argument('--balanced', action='store_true', help='Exploratory train-only weights and per-label validation thresholds')
    args = p.parse_args()
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    torch.set_num_threads(2); torch.use_deterministic_algorithms(True)
    rows = read_jsonl(args.data)
    rows = sorted(rows, key=lambda r: hashlib.sha256((str(args.seed)+r['sample_id']).encode()).hexdigest())[:args.max_samples]
    feature_map = {r['sample_id']: r for r in read_jsonl(args.features) if r.get('status') == 'ok'} if args.features else {}
    # Compare only identical samples when features are requested; failed queries are excluded and counted.
    selected = rows
    if args.features:
        rows = [r for r in rows if r['sample_id'] in feature_map]
    labels = sorted(rows[0]['labels'])
    y = np.array([[int(r['labels'][k]) for k in labels] for r in rows], dtype='float32')
    splits = {s: np.array([i for i,r in enumerate(rows) if r['split']==s], dtype=int) for s in ('train','val','test')}
    groups = {s: {rows[i]['game_sha256'] for i in idx} for s,idx in splits.items()}
    assert not (groups['train'] & groups['val'] or groups['train'] & groups['test'] or groups['val'] & groups['test']), 'game leakage'
    assert all(len(v) for v in splits.values()), 'each split must have samples'
    report = {'seed': args.seed, 'target': 'human comment keyword weak labels; NOT Go concept correctness',
              'balanced': args.balanced, 'evaluation_status': 'exploratory: test already observed in earlier protocol' if args.balanced else 'initial fixed protocol',
              'data_sha256': hashlib.sha256(Path(args.data).read_bytes()).hexdigest(),
              'labels': labels, 'selected_samples': len(selected), 'feature_failures_excluded': len(selected)-len(rows),
              'split_counts': {s: len(idx) for s,idx in splits.items()},
              'game_counts': {s: len(g) for s,g in groups.items()},
              'split_label_positives': {s: dict(zip(labels, y[idx].sum(0).astype(int).tolist())) for s,idx in splits.items()},
              'validation_labels_without_positives': [labels[j] for j in range(len(labels)) if y[splits['val'],j].sum()==0],
              'runtime': {'torch': torch.__version__, 'numpy': np.__version__},
              'sample_ids': {s: [rows[i]['sample_id'] for i in idx] for s,idx in splits.items()},
              'train_prevalence': dict(zip(labels, y[splits['train']].mean(0).tolist())), 'models': {}}
    if args.features:
        metadata_path = Path(args.features+'.meta.json')
        feature_metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        assert feature_metadata['data_sha256'] == report['data_sha256'], 'features generated from different dataset'
        report['feature_metadata'] = feature_metadata
    tr, va, te = (splits[s] for s in ('train','val','test'))
    majority = (y[tr].mean(0)>=0.5).astype(int)
    freq = np.tile(y[tr].mean(0),(len(te),1))
    report['models']['majority'] = {'test': metrics(y[te], np.tile(majority,(len(te),1)), labels,freq)}
    report['models']['frequency_dummy'] = {'test':metrics(y[te],freq>=0.5,labels,freq)}
    report['models']['always_positive'] = {'test': metrics(y[te], np.ones_like(y[te]), labels,np.ones_like(y[te]))}
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    for mode in (['board', 'board_katago'] if args.features else ['board']):
        x = np.stack([planes(r, feature_map[r['sample_id']] if mode=='board_katago' else None) for r in rows])
        flat = x.reshape(len(x), -1)
        linear = []
        for j in range(len(labels)):
            if len(np.unique(y[tr,j])) < 2:
                linear.append(np.full(len(x), y[tr,j][0]))
            else:
                clf = LogisticRegression(C=0.01, max_iter=500, random_state=args.seed,class_weight='balanced' if args.balanced else None)
                clf.fit(flat[tr], y[tr,j]); linear.append(clf.predict_proba(flat)[:,1])
        probs = np.stack(linear,1)
        threshold = select_thresholds(y[va],probs[va],args.balanced)
        report['models'][mode+'_linear'] = {'threshold_selected_on_val': threshold_json(threshold),
            'val': metrics(y[va],probs[va]>=threshold,labels,probs[va]), 'test': metrics(y[te],probs[te]>=threshold,labels,probs[te])}
        np.savez_compressed(out/(mode+'_linear.test.local.npz'), truth=y[te], scores=probs[te],
                            prediction=probs[te]>=threshold, sample_ids=[rows[i]['sample_id'] for i in te], labels=labels)
        torch.manual_seed(args.seed)
        model = TinyCNN(x.shape[1],len(labels)); opt = torch.optim.Adam(model.parameters(),lr=0.003)
        xt = torch.from_numpy(x); yt = torch.from_numpy(y)
        positives = y[tr].sum(0)
        weights = np.minimum((len(tr)-positives)/np.maximum(positives,1),20).astype('float32')
        loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.from_numpy(weights) if args.balanced else None)
        best_score=-1; best_state=None; best_threshold=None; best_epoch=None
        for epoch in range(args.epochs):
            model.train()
            for batch in torch.randperm(len(tr)).split(32):
                ix = tr[batch.numpy()]; opt.zero_grad(); loss=loss_fn(model(xt[ix]),yt[ix]); loss.backward(); opt.step()
            model.eval()
            with torch.no_grad(): vp = model(xt[va]).sigmoid().numpy()
            t = select_thresholds(y[va],vp,args.balanced)
            score = f1_score(y[va],vp>=t,average='macro',zero_division=0)
            if score>best_score:
                best_score=score; best_state={k:v.detach().clone() for k,v in model.state_dict().items()}; best_threshold=t; best_epoch=epoch+1
        model.load_state_dict(best_state); model.eval()
        # Test is evaluated exactly once after all model/threshold selection on validation.
        with torch.no_grad(): vp=model(xt[va]).sigmoid().numpy(); tp=model(xt[te]).sigmoid().numpy()
        report['models'][mode+'_cnn'] = {'epoch_selected_on_val':best_epoch,'threshold_selected_on_val':threshold_json(best_threshold),
            'train_pos_weights':dict(zip(labels,weights.tolist())) if args.balanced else None,
            'parameters':sum(v.numel() for v in model.parameters()), 'val':metrics(y[va],vp>=best_threshold,labels,vp),
            'test':metrics(y[te],tp>=best_threshold,labels,tp)}
        torch.save(best_state,out/(mode+'_cnn.local.pt'))
        np.savez_compressed(out/(mode+'_cnn.test.local.npz'), truth=y[te], scores=tp,
                            prediction=tp>=best_threshold, sample_ids=[rows[i]['sample_id'] for i in te], labels=labels)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k: v['test']['macro_f1'] for k,v in report['models'].items()}))


if __name__ == '__main__': main()
