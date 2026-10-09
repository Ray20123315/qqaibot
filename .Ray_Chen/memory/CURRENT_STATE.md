# CURRENT_STATE

- main at start 24a33000916d239caa1b9fcac789213972a5d041, Cloudflare Bbot-only parallel-v3 code active.
- archive/legacy-main-20261009 intact, commit 6a22b06433cfaffcf13abe2b60a917305290b629.
- Feature branch feature/recall-and-group-controls-20261010: NapCat Bbot-only, recall mapping is additive D1 tables bridge_recall_map / bridge_recalled_sources / bridge_recall_queue.
- bridge_groups.receive_only newly added with default 0. No old groups removed or changed; normal mode remains dual.
- !CODE --no sets new joined group receive_only, no outward notifications; others can relay INTO this group.
- !setting shows permissions and linked group list. Normal joins enqueue notices to other active groups.
- Native at only if numeric target exists in fresh roster, otherwise nickname not QQ ID. face/mface keep types, JSON/XML card textualized.
- Bbot hub generation recall-v4 is new; needs NapCat Client restart after production deploy.
- CI not yet checked; live recall and QQ format verification UNKNOWN.
