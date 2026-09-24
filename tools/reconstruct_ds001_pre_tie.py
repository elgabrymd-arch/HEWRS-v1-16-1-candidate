#!/usr/bin/env python3
"""Optional full provenance reconstruction from the copied original code/input bytes."""
from pathlib import Path
import os,sys,hashlib,io,json
R=Path(__file__).resolve().parents[1];P=R/'provenance/open_collar_v1_13'
for file,sha in json.loads((P/'original_input_hashes.json').read_text()).items():
 assert hashlib.sha256((P/'original_inputs'/file).read_bytes()).hexdigest()==sha,file
os.environ['HEWRS_ASSETS']=str(P/'original_inputs');sys.path.insert(0,str(P/'original_code'))
import assemble_shirt
from PIL import Image
arr=assemble_shirt.build('White solid',ds='DS001');buf=io.BytesIO();Image.fromarray(arr).save(buf,format='PNG');raw=buf.getvalue()
assert raw==(P/'DS001_ORIGINAL_PRE_TIE_RECONSTRUCTION.png').read_bytes(),'Pre-tie source reconstruction mismatch'
print(json.dumps({'source_reconstruction':'byte-identical','sha256':hashlib.sha256(raw).hexdigest()}))
