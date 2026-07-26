from pathlib import Path
import re

path = Path('worker.js')
source = path.read_text()
pattern = re.compile(r'return jsonReply\(`\$\{atSender\}主人等级：Lv\.\$\{level\}/\$\{MASTER_RELATIONSHIP_MAX_LEVEL\}.*?任何等级都没有踢出权限。主人只能解除自己造成的主人禁言，不能解除群规、自我禁言、对象禁言或管理防解除。`\);', re.S)
replacement = 'return jsonReply(`${atSender}主人等级：Lv.${level}/${MASTER_RELATIONSHIP_MAX_LEVEL}\\n${lines.join("\\n")}\\n${next}\\n任何等级都没有踢出权限。主人只能解除自己造成的主人禁言，不能解除群规、自我禁言、对象禁言或管理防解除。`);'
source, count = pattern.subn(lambda _: replacement, source, count=1)
if count != 1:
    raise RuntimeError('Missing generated master feature output')
path.write_text(source)
print('Master level output escaping fixed')
