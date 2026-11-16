from pathlib import Path
import hashlib,json,os
project=Path(__file__).resolve().parents[1]
baseline=json.loads((project/'verification/original-baseline.json').read_text(encoding='utf-8'))
source=Path(baseline['source'])
files={};directories=[];links=[]
for base,folders,names in os.walk(source,followlinks=False):
 for name in folders:
  p=Path(base)/name
  if p.is_symlink():links.append(str(p))
  directories.append(p.relative_to(source).as_posix())
 for name in names:
  p=Path(base)/name
  if p.is_symlink():links.append(str(p))
  st=p.stat();files[p.relative_to(source).as_posix()]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':st.st_size,'mtime_ns':st.st_mtime_ns}
old=baseline['files']
report={'unchanged':files==old and sorted(directories)==baseline['directories'] and not links,'file_count':len(files),'added':sorted(set(files)-set(old)),'removed':sorted(set(old)-set(files)),'changed':sorted(k for k in set(files)&set(old) if files[k]!=old[k]),'directories_unchanged':sorted(directories)==baseline['directories'],'links':links,'method':'SHA-256 + byte size + mtime_ns + complete path inventory, hidden/untracked files included'}
(project/'verification/original-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
raise SystemExit(0 if report['unchanged'] else 1)
