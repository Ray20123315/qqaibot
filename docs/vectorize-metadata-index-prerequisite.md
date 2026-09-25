# Vectorize metadata indexes

The `qqai` index currently has no metadata indexes. Portal chat-log and memory searches apply metadata filters, so the required indexes must exist before those filtered queries can work reliably.

Create these five indexes in the Cloudflare account that owns `qqai`:

```sh
npx wrangler vectorize create-metadata-index qqai --property-name=kind --type=string
npx wrangler vectorize create-metadata-index qqai --property-name=groupId --type=string
npx wrangler vectorize create-metadata-index qqai --property-name=userId --type=string
npx wrangler vectorize create-metadata-index qqai --property-name=qq --type=string
npx wrangler vectorize create-metadata-index qqai --property-name=subjectQq --type=string
npx wrangler vectorize list-metadata-index qqai
```

The list command should show all five properties. Metadata index creation is an account-level Vectorize operation and is not performed by Worker deployment or D1 migrations. This repository change records the prerequisite; it does not mutate the production index.
