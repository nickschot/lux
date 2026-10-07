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
7. **[Migrations and seeds](migrations.md)** — writing and running
   migrations, seeding, and creating and resetting databases.
8. **[Logging](logging.md)** — configuration, what is logged at each level,
   request ids, filtering credentials, and logging from your code.
9. **[The `lumen` command](cli.md)** — every command and option: generators,
   `serve`, `build`, `console` and the database commands.

One more guide is on the way: deployment. Until it lands,
[UPGRADING.md](../../UPGRADING.md) covers it.

Also useful:

- [examples/social-network](../../examples/social-network/) — an example app
  that uses most of the framework, with a map of where each feature lives.
- The API reference — run `pnpm docs:api` in a checkout of this repository
  and open `docs/api/index.html`.
