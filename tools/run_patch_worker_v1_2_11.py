from pathlib import Path

patch_path = Path("tools/patch_worker_v1_2_11.py")
source = patch_path.read_text(encoding="utf-8")

# The source worker contains literal backslash-n sequences in this one prompt line.
# Remove the formatting-sensitive replacement from the generated patch program,
# then inject the safety rule by a stable neighboring comment marker.
start_marker = "replace_once(\n'''      if (dynamicPersona !== \"\") {"
start = source.index(start_marker)
end = source.index("\nreplace_once(", start + len(start_marker))
source = source[:start] + source[end + 1:]

namespace = {"__name__": "__main__", "__file__": str(patch_path)}
exec(compile(source, str(patch_path), "exec"), namespace)

worker_path = Path("worker.js")
worker = worker_path.read_text(encoding="utf-8")
anchor = "\n\n// 💖 叠加高情商情绪微调 BUFF"
safety = '''
      finalStylePrompt += `

【命令前缀安全规则】
你绝对不能以 //、/!、! 或！开头输出，也不能模仿用户输入这些控制前缀、声称已经执行机器人命令、诱导绕过权限，或用命令实施违法违规行为。需要说明命令时，只能把命令放在引号或代码样式的普通说明文字中。`;
'''
if worker.count(anchor) != 1:
    raise RuntimeError(f"safety prompt anchor count: {worker.count(anchor)}")
worker = worker.replace(anchor, "\n" + safety + anchor, 1)
if "【命令前缀安全规则】" not in worker:
    raise RuntimeError("safety prompt injection failed")
worker_path.write_text(worker, encoding="utf-8", newline="\n")
print("injected command-prefix safety prompt")
