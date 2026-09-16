import json,re
from pathlib import Path

root=Path(__file__).parents[1]/'extension'
m=json.loads((root/'manifest.json').read_text())

refs=[m['background']['service_worker'],m['side_panel']['default_path'],*m['icons'].values()]
for ref in refs:
    assert (root/ref).is_file(),ref

assert 'default_popup' not in m.get('action',{})
origins=set(m.get('host_permissions',[]))
assert 'https://www.google.com/*' in origins
assert 'https://maps.google.com/*' in origins
assert 'https://*/*' not in origins
assert not m.get('optional_host_permissions',[])
assert m['background']['service_worker']=='background-wrapper.js'

wrapper=(root/'background-wrapper.js').read_text()
for imported in re.findall(r'importScripts\(["\']([^"\']+)["\']\)',wrapper):
    assert (root/imported).is_file(),imported

for file in root.rglob('*'):
    if file.suffix in {'.js','.html'}:
        text=file.read_text(errors='ignore')
        assert not re.search(r'\beval\s*\(|new\s+Function\s*\(',text),file
        assert not re.search(r'<script[^>]+src=["\']https?://',text,re.I),file
print('Manifest references, Maps-only origins, wrapper imports, and local-code policy checks passed')
