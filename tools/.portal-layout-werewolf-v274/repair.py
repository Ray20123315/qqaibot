from pathlib import Path

path = Path(__file__).with_name("apply.py")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        "death_block_pattern = re.compile(r'''function deathSkillEligible\\(player, cause\\) \\{[\\s\\S]*?\\n\\}\\n\\n\\nfunction promoteApprentice''')",
        "death_block_pattern = re.compile(r'''function deathSkillEligible\\(player, cause\\) \\{[\\s\\S]*?\\n\\}\\s*function promoteApprentice''')",
        "death block matcher",
    ),
    (
        "night_end = werewolf.index('  player.roleState[usedKey] = true;', night_start)",
        "night_end = werewolf.index('  player.lastActionAt = nowMs();', night_start)",
        "night action block end",
    ),
    (
        '''for path in ROOT.glob("verify-*.mjs"):
    text = path.read_text(encoding="utf-8").replace('"2.7.3"', '"2.7.4"')
    path.write_text(text, encoding="utf-8")''',
        '''for path in ROOT.glob("verify-*.mjs"):
    source = path.read_text(encoding="utf-8")
    updated_lines = []
    for line in source.splitlines(keepends=True):
        if "version" in line.lower():
            line = re.sub(r"(?P<quote>['\\\"])\\d+\\.\\d+\\.\\d+(?P=quote)", lambda match: f"{match.group('quote')}2.7.4{match.group('quote')}", line)
        updated_lines.append(line)
    path.write_text("".join(updated_lines), encoding="utf-8")''',
        "version assertion updater",
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise RuntimeError(f"{label} anchor not found")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("builder matchers repaired")
