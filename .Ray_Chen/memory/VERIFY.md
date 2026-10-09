# VERIFY

- Feature branch Github CI: npm run check = node --test tests/*.test.mjs AND npx wrangler deploy --dry-run --outdir dist --no-assets.
- Test targets: protected QQ admin lock, slash parser, rich media normalization, explicit denial Bbot fallback, ambiguous timeout no fallback, OneBot send ACK, official media API.
- Validate memory TAR.GZ contents and SHA256 via same CI workflow.
- Required real QQ isolation tests: Abot proactive group permissions, QQ group OpenID linkage, Bbot reverse WS secured, JPEG / video / voice / file uploads, true group @, fallback send ACK and dedup.
- main currently unchanged; old archive ref 6a22b06433cfaffcf13abe2b60a917305290b629 available for rollback.
