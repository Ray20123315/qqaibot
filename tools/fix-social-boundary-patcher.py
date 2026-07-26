from pathlib import Path

path = Path('tools/apply-social-boundaries-v2.5.2.py')
source = path.read_text()
old = '    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)\n'
new = '    next_text, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)\n'
if old not in source:
    raise RuntimeError('must_regex implementation anchor missing')
path.write_text(source.replace(old, new, 1))
print('social boundary patcher escape handling fixed')
