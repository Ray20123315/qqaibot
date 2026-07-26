from pathlib import Path

path = Path('tools/apply-social-boundaries-v2.5.2.py')
source = path.read_text()
old = '    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)\n'
new = '    next_text, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)\n'
if old not in source:
    raise RuntimeError('must_regex implementation anchor missing')
source = source.replace(old, new, 1)
verify_anchor = "    text = verify_path.read_text()\n"
verify_replacement = "    text = verify_path.read_text()\n    text = text.replace('2.5.1', '2.5.2')\n"
if verify_anchor not in source:
    raise RuntimeError('verify version migration anchor missing')
source = source.replace(verify_anchor, verify_replacement, 1)
path.write_text(source)
print('social boundary patcher escape handling and version migration fixed')
