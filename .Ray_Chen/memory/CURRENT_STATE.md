# CURRENT_STATE

- QQAIBOT production branch main source commit 4db8fcbf844fc0cc64b4a1cf3919e18dcef5902f, deployed via Cloudflare connected build success.
- Cloudflare deployment 0f0dd1fc-54f1-4773-9de3-59a269ffbeb8 version be4ec8e1-656d-43c7-9b55-00d5eafab839, 100% traffic, source 4db8fcbf844fc0cc64b4a1cf3919e18dcef5902f.
- GitHub feature CI 37961297179 passed full node tests and Wrangler dry-run; main code CI triggered by fast-forward also expected to pass, final v0.0.78 memory artifact pending.
- Canonical old branch archive/legacy-main-20261009 (6a22b06433cfaffcf13abe2b60a917305290b629) unchanged.
- New Bbot DO identity bridge-bbot-napcat-v2 requires reconnect of existing NapCat reverse WebSocket Client; no secret change.
- !use in first group and !CODE alias in second group can now be received and replied to exclusively by Bbot, independent of Abot Group OpenID.
- D1 bridge_groups uses synthetic group_openid napcat:<qqgroup> for NapCat-only groups, never passed to official API. Existing Abot entries retained.
- Bbot official receive send QQ practical client acceptance still UNKNOWN, no fabricated chat proof.
