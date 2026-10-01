# CURRENT_STATE

## Production Before Goal Revision 2

- main head: `5b7f3c5e1c75d98150d794b2d2c689c77a145bfc`
- deployed product revision: `6cb891571bdb2744b13bd11e3731c2a267fdf1ed`
- previous production Connected Build: `d8abfda4-4595-427a-8fbf-7f0a5ffcd31f` — success

## Confirmed Native Discovery Defect

`src/v4/qqopen/discovery.js` currently builds:
- one global group panel from `buildGroupRootPanel()`;
- that root panel contains only `!面板 <分类>` placeholder commands;
- actual group commands exist in the registry and inline keyboards, but are not registered directly into QQ native group panels.

The live QQ client screenshot confirms this exact state.

## Target State

- global group discovery uses `registry.buildCategorizedPanels("group", ...)`;
- each panel contains real canonical commands;
- categories are represented by panel remarks/partitioning rather than placeholder commands;
- `!面板 <分类>` inline keyboards remain available when invoked manually;
- developer C2C panels remain specific-target panels.

## Verification State

- product patch: PLANNED
- development CI: PENDING
- main update: PENDING
- main CI: PENDING
- production Connected Build: PENDING
- native QQ resync smoke: PENDING_USER
