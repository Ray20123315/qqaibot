from pathlib import Path

path = Path(__file__).with_name("apply.py")
text = path.read_text(encoding="utf-8")
old = "death_block_pattern = re.compile(r'''function deathSkillEligible\\(player, cause\\) \\{[\\s\\S]*?\\n\\}\\n\\n\\nfunction promoteApprentice''')"
new = "death_block_pattern = re.compile(r'''function deathSkillEligible\\(player, cause\\) \\{[\\s\\S]*?\\n\\}\\s*function promoteApprentice''')"
if old not in text:
    raise RuntimeError("death block matcher anchor not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("builder matchers repaired")
