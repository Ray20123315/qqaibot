# CURRENT_STATE
- main prior to Bbot-only promotion e02b5ecd94ef51a70a1299e3f28ea0a578dc4738
- feature Bbot-only code branch feature/bbot-only-20261010; preserved archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
- CI 37963768519 34/35 passed; last failure only test mock request.url on string in fake Bbot health
- tests/abot-disabled.test.mjs now normalizes both mocked request objects; code not modified in this revision
- no QQ official API imported by active Worker and delivery; pending live verification
