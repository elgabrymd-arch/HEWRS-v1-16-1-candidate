#!/usr/bin/env python3
"""Reconstruct exact V1.21.0 in a NEW folder; no browser/storage/network access."""
from pathlib import Path
import json,hashlib,shutil,argparse
R=Path(__file__).resolve().parents[1];D=R/'rollback/option_cards_v1_21_1'
def main():
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--output',type=Path);a.add_argument('--check',action='store_true');args=a.parse_args();m=json.loads((D/'BASELINE_PACKAGE_SHA256.json').read_text());todo=[]
 for d in m['files']:
  rel=d['path'];source=D/'original'/rel
  if not source.exists():source=R/rel
  raw=source.read_bytes();assert len(raw)==d['bytes'] and hashlib.sha256(raw).hexdigest()==d['sha256'],rel;todo.append((source,rel))
 raw=(D/'BASELINE_PACKAGE_SHA256.json').read_bytes();manifest_hash=json.loads((D/'RESTORE.json').read_text())['baseline_manifest_sha256'];assert hashlib.sha256(raw).hexdigest()==manifest_hash
 if args.output:
  if args.output.exists():raise SystemExit('Output exists; choose a new folder')
  args.output.mkdir(parents=True)
  for source,rel in todo:
   p=args.output/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,p)
  shutil.copy2(D/'BASELINE_PACKAGE_SHA256.json',args.output/'PACKAGE_SHA256.json')
 elif not args.check:a.error('Use --check or --output NEW_FOLDER')
 print(json.dumps({'status':'PASS','baseline':'1.21.0','restored_payloads':len(todo),'output':str(args.output)if args.output else None,'no_browser_data_access':True}))
if __name__=='__main__':main()
