# Lumen guides

Guides to building a JSON:API server with Lumen, written for Lumen 4.0.

1. **[Getting started](getting-started.md)** — create a project, generate two
   related resources, and make your first requests.
2. **[Routing](routing.md)** — resources, relationship and related endpoints,
   custom routes, and namespaces.
3. **[Controllers](controllers.md)** — accepting writes, what clients may ask
   for, overriding and adding actions, hooks, and visibility rules.
4. **[Serializers and JSON:API](serializers.md)** — attributes and
   relationships, `linksOnly`, the document, `include`, sparse fieldsets,
   per-namespace serializers, and what clients may send.
5. **[Models and queries](models.md)** — relationships, validations, hooks,
   writing records, the query methods, scopes and transactions.
6. **[Errors](errors.md)** — the error documents clients receive, every status
   Lumen reports, and reporting errors from your own code.

More guides are on the way: migrations and seeds, logging, the CLI, and
deployment. Until they land, [UPGRADING.md](../../UPGRADING.md) is the
most complete description of those topics.

Also useful:

- [examples/social-network](../../examples/social-network/) — an example app
  that uses most of the framework, with a map of where each feature lives.
- The API reference — run `pnpm docs:api` in a checkout of this repository
  and open `docs/api/index.html`.
