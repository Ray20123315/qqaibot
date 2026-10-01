# CURRENT_STATE

## Production Before Goal Revision 3

- main head: `8beea65b514484e6ed5ec352640492693b4d4901`
- deployed product revision: `9f78fc66547d278a72858bbd25a22f00dda7ba2a`
- previous main CI: `36872340755` — success
- previous production Connected Build: `521ccfd8-bc55-4aff-9fdb-f0515f5ebcea` — success

## Live User Evidence

The native QQ panel still demonstrates why publishing every concrete command directly is the wrong UX: the client only shows a constrained subset. The intended solution is category-entry discovery plus the bot's own paginated inline keyboard.

## Confirmed Unwanted Feature State

- 狼人杀/狼人殺 is already absent from worker runtime and has an existing transition-cleanup assertion.
- 主人/对象 relationship functionality is still active in worker handlers and still has Portal backend/client surfaces.
- Relationship command registrations and a relationship panel category are still present.

## Target State

- restore one managed group category-root native panel;
- remove relationship category/commands/handlers/Portal controls;
- keep old relationship data cleanup and old lock compatibility only;
- strengthen regressions so removed features do not return.

## Verification State

- product patch: PLANNED
- development CI: PENDING
- main update: PENDING
- main CI: PENDING
- production Connected Build: PENDING
- live QQ smoke: PENDING_USER
