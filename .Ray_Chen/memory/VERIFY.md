# VERIFY
- Feature CI 37969072123 SUCCESS and production main CI 37969193082 SUCCESS with Node test suite and Wrangler dry-run.
- New tests include card-as-text, native QQ face/mface, native destination at vs source nickname, group recall event parsing, two-target mapping, duplicate event and late recall, ACK returns message_id.
- --no join, !setting roles and linked groups tested; historical protected ACL tests preserved.
- Deployed qqai 7903d855-69bb-49d1-9d49-2c85ef5fd16a version ed71a6b6-dbd6-4402-a4f2-e0a311e606d5 100%, source 61666942ac971a4d52c88105a1970898a180f340.
- v0.0.88 final memory archive CI pending for memory-only commit.
- Real QQ two/three group relay, Bilibili card, mface sticker, original/admin recall must be observed after NapCat client reconnect; no premature claims.
