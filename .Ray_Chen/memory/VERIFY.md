# VERIFY
- Branch feature/no-politics-guard-20261010 CI run 38063487027 SUCCESS.
- Production main code CI 38063546208 SUCCESS.
- Both run npm run check with Node tests (Abot input/output suppression, Bbot input/output suppression, classifier Traditional/Simplified/English and normal controls), Wrangler dry-run. Real QQ and Gemini calls not used for these tests.
- Cloudflare qqai main code deployment d6e05bc2-aa97-49a1-a8c6-7742c74eee67, version c8c4f8b2-d1ff-489e-af4d-cd68a400e4f3, code SHA 6fa907d2a6bede25243faa130f9ac9e4cb6e202f, build success, traffic 100%.
- Final memory v0.0.96 package CI/sha pending; check main version then artifact SHA.
- Manual QQ smoke not performed; test with real @ Abot in allowed group and verify policy's refusal and Gemini normal answer.
