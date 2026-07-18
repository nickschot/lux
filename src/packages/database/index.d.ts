// TEMPORARY type shim for the not-yet-converted `database` package (Flow .js).
// Describes ONLY the surface the logger/server/router cluster consumes. Delete
// this file when `database` is converted to TypeScript — see CLAUDE.md
// "Phase 3 status". Runtime is unaffected: Babel/esbuild ignore `.d.ts`, so the
// real `database/index.js` is what loads.

export interface Database$column {
  type: string;
  nullable: boolean;
  defaultValue: unknown;
}

export interface Database$relationship {
  type: string;
  model: ModelClass;
}

/** The static-bearing model *class* (`Class<Model>` in Flow). */
export interface ModelClass {
  primaryKey: string;
  resourceName: string;
  serializer: { attributes: Array<string> };
  columnFor(key: string): Database$column | undefined;
  relationshipFor(key: string): Database$relationship | undefined;
}

export class Query<T = unknown> extends Promise<T> {
  static from(query: Query<unknown>): Query<unknown>;
  count(): Query<number>;
}

export function typeForColumn(column: Database$column): string | undefined;
