import json,re
from pathlib import Path

root=Path(__file__).parents[1]/'extension'
m=json.loads((root/'manifest.json').read_text())
refs=[m['background']['service_worker'],m['action']['default_popup'],m['side_panel']['default_path'],*m['icons'].values()]
for ref in refs: assert (root/ref).is_file(),ref
assert 'https://*/*' not in m.get('host_permissions',[])
assert 'https://*/*' in m.get('optional_host_permissions',[])
for file in root.rglob('*'):
    if file.suffix in {'.js','.html'}:
        text=file.read_text(errors='ignore')
        assert not re.search(r'\beval\s*\(|new\s+Function\s*\(',text),file
        assert not re.search(r'<script[^>]+src=["\']https?://',text,re.I),file
print('Manifest references, optional origins, and local-code policy checks passed')
