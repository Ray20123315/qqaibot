# CURRENT_STATE

## Development

- development branch: `v4-qqopen-native`
- verified product commit: `9f78fc66547d278a72858bbd25a22f00dda7ba2a`
- development CI: `36871773623` — success

## Native Group Discovery

The previous root-only design is removed from discovery sync. Global group discovery now:
- uses `registry.buildCategorizedPanels("group", ...)`;
- publishes the actual canonical PanelItem commands;
- partitions by discovery category;
- caps each panel at 20 items;
- keeps total group + developer C2C panels under the implementation limit;
- does not publish `!面板 <分类>` placeholders as the native command list.

Manual `!面板 <分类>` inline keyboards remain available separately.

## Production

- current main before promotion: `5b7f3c5e1c75d98150d794b2d2c689c77a145bfc`
- current deployed product before promotion: `6cb891571bdb2744b13bd11e3731c2a267fdf1ed`
- main promotion of `9f78fc...`: PENDING
- production Connected Build: PENDING

## Verification State

- product patch: VERIFIED_DEVELOPMENT
- development CI: VERIFIED
- main update: PENDING
- main CI: PENDING
- production Connected Build: PENDING
- live QQ native discovery: PENDING_USER
