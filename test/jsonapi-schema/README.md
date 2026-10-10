# JSON:API 1.0 response schema

`1.0.json` is the JSON Schema for JSON:API 1.0 **responses**, copied unchanged
from the spec's repository:
[`json-api/json-api` → `_schemas/1.0/schema.json`](https://github.com/json-api/json-api/blob/gh-pages/_schemas/1.0/schema.json),
last changed upstream in af47518 (2024-05-19).

It is kept here so the tests don't reach the network and the schema can't
change under them. To update it, copy the file again and record the commit.

The schema is informative, not normative: where it disagrees with the spec
text, the spec wins. `test/utils/expect-jsonapi-document.ts` validates with
it.
