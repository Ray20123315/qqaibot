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
]

for old, new, label in replacements:
    if old not in text:
        raise RuntimeError(f"{label} anchor not found")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("builder matchers repaired")
