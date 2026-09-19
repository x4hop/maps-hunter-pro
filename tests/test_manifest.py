import json,re
from pathlib import Path

root=Path(__file__).parents[1]/'extension'
m=json.loads((root/'manifest.json').read_text())
assert m['manifest_version']==3
assert m['version']=='1.1.0'
for ref in [m['background']['service_worker'],m['side_panel']['default_path'],*m['icons'].values()]:
    assert (root/ref).is_file(),ref
permissions=set(m.get('permissions',[]))
assert {'activeTab','downloads','scripting','sidePanel','storage','unlimitedStorage'} <= permissions
origins=set(m.get('host_permissions',[]))
assert 'http://*/*' in origins and 'https://*/*' in origins
wrapper=(root/'background-wrapper.js').read_text()
for imported in re.findall(r'importScripts\(["\']([^"\']+)["\']\)',wrapper):
    assert (root/imported).is_file(),imported
assert 'contact-enrichment.js' in wrapper
assert 'contact-extraction-fix.js' in wrapper
assert 'state.enrichWebsites = true' in wrapper
for file in root.rglob('*'):
    if file.suffix in {'.js','.html'}:
        text=file.read_text(errors='ignore')
        assert not re.search(r'\beval\s*\(|new\s+Function\s*\(',text),file
        assert not re.search(r'<script[^>]+src=["\']https?://',text,re.I),file
print('Stable manifest and website-enrichment policy checks passed')
