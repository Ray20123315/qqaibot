from pathlib import Path

path = Path('tools/apply-master-levels-v2.5.1.py')
source = path.read_text()
before = r'async function updateMasterBindingPermissions\(env, groupId, userId, patch, updatedBy = ""\) \{.*?\n\}\nasync function clearPartnerBinding'
after = r'async function updateMasterBindingPermissions\(env, groupId, userId, patch, updatedBy = ""\) \{.*?\n\}\n\s*async function clearPartnerBinding'
if before not in source:
    raise RuntimeError('Missing updater regex in patcher')
path.write_text(source.replace(before, after, 1))
print('Master level patch anchor widened')
