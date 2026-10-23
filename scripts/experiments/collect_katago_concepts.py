"""Collect official KataGo BLACK ownership/policy. Errors never become zero maps."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import queue
import subprocess
import threading
import time


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def normalized_rules(raw):
    aliases = {'japanese':'japanese', 'japan':'japanese', 'jp':'japanese',
               'chinese':'chinese', 'china':'chinese', 'cn':'chinese',
               'aga':'aga', 'korean':'korean', 'korea':'korean',
               'new zealand':'new-zealand', 'new-zealand':'new-zealand', 'nz':'new-zealand',
               'tromp-taylor':'tromp-taylor', 'tromp taylor':'tromp-taylor', 'tt':'tromp-taylor',
               'stone-scoring':'stone-scoring'}
    value = aliases.get(str(raw).strip().lower())
    return (value, None) if value else ('japanese', 'unknown or missing SGF rules; Japanese fallback')


def main():
    p=argparse.ArgumentParser()
    for name in ('data','binary','model','config','out'): p.add_argument('--'+name,required=True)
    p.add_argument('--max-samples',type=int,default=300)
    p.add_argument('--seed',type=int,default=20261002)
    p.add_argument('--timeout',type=float,default=120)
    p.add_argument('--visits',type=int,default=16)
    args=p.parse_args()
    rows=[json.loads(s) for s in Path(args.data).read_text(encoding='utf-8').splitlines() if s.strip()]
    rows=sorted(rows,key=lambda r:hashlib.sha256((str(args.seed)+r['sample_id']).encode()).hexdigest())[:args.max_samples]
    out=Path(args.out); out.parent.mkdir(parents=True,exist_ok=True)
    version=subprocess.run([args.binary,'version'],capture_output=True,text=True,timeout=30)
    meta={'binary_sha256':sha(args.binary),'model_sha256':sha(args.model),'model_file':Path(args.model).name,
          'version':version.stdout.strip(),'config_sha256':sha(args.config),'perspective':'BLACK','visits':args.visits,
          'data_sha256':sha(args.data),'seed':args.seed}
    meta['alignment'] = 'after played move: predicts comment mentions; does not explain intent from pre-move candidate comparison'
    Path(str(out)+'.meta.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    log=open(str(out)+'.stderr.log','w',encoding='utf-8')
    proc=subprocess.Popen([args.binary,'analysis','-model',args.model,'-config',args.config],stdin=subprocess.PIPE,
                          stdout=subprocess.PIPE,stderr=log,text=True,bufsize=1)
    q=queue.Queue()
    def reader():
        for line in proc.stdout:
            try: q.put(json.loads(line))
            except json.JSONDecodeError: q.put({'invalid_output':line[:500]})
        q.put({'process_eof':True})
    threading.Thread(target=reader,daemon=True).start()
    try:
        with out.open('w',encoding='utf-8') as f:
            for sample_index, row in enumerate(rows, 1):
                rule, fallback = normalized_rules(row.get('rules'))
                query={'id':row['sample_id'],'boardXSize':19,'boardYSize':19,'rules':rule,
                       'komi':float(row.get('komi',6.5)), 'initialStones':row['initial_stones'],
                       'moves':row['moves_after'],'maxVisits':args.visits,'includeOwnership':True,'includePolicy':True,
                       'overrideSettings':{'reportAnalysisWinratesAs':'BLACK'}}
                start=time.monotonic(); record={'sample_id':row['sample_id'], 'rules_source':row.get('rules'),
                    'rules_used':rule, 'rules_fallback':fallback, 'komi_source':row.get('komi'), 'komi_used':query['komi']}
                try:
                    proc.stdin.write(json.dumps(query)+'\n'); proc.stdin.flush()
                    while True:
                        remaining=args.timeout-(time.monotonic()-start)
                        if remaining<=0: raise TimeoutError('analysis timeout')
                        result=q.get(timeout=remaining)
                        if result.get('process_eof'): raise RuntimeError('KataGo exited')
                        if result.get('id') != row['sample_id']: continue
                        if result.get('error'): raise RuntimeError(result['error'])
                        if result.get('isDuringSearch'): continue
                        own=result.get('ownership'); policy=result.get('policy')
                        if own is None or policy is None or len(own)!=361 or len(policy)!=362: raise RuntimeError('missing or invalid feature map')
                        if not all(isinstance(v,(int,float)) and math.isfinite(v) and -1<=v<=1 for v in own+policy):
                            raise RuntimeError('nonfinite or out-of-range feature map')
                        moves = [{k:m.get(k) for k in ('move','prior','visits','pv','winrate','scoreLead')}
                                 for m in result.get('moveInfos',[])[:3]]
                        record.update(status='ok',ownership=own,policy=policy,rootInfo=result.get('rootInfo',{}),moveInfos=moves); break
                except (queue.Empty,TimeoutError,RuntimeError,BrokenPipeError) as exc:
                    record.update(status='error',error=str(exc) or 'analysis timeout; no features emitted')
                record['elapsed_seconds']=time.monotonic()-start
                f.write(json.dumps(record)+'\n'); f.flush()
                if sample_index % 25 == 0 or sample_index == len(rows) or record['status'] != 'ok':
                    print(sample_index, '/', len(rows), record['sample_id'], record['status'],flush=True)
                if proc.poll() is not None: break
    finally:
        proc.terminate()
        try: proc.wait(timeout=10)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait()
        log.close()


if __name__=='__main__': main()
