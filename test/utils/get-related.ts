import { readAttribute } from '../../src/packages/database';
import type { Model } from '../../src/packages/database';

/**
 * Read a relationship through the model's lazy getter — the source of truth
 * the serializer's batch-loaded linkage is checked against. A belongs-to whose
 * foreign key points at a deleted record makes the getter throw a 404
 * (`RecordNotFoundError`); the serializer resolves that to `null`, as the
 * primary query's join does, so the oracle does too.
 */
export async function getRelated(
  record: Model,
  name: string
): Promise<Model | Array<Model> | null> {
  try {
    return ((await readAttribute(record, name)) ?? null) as
      Model | Array<Model> | null;
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) {
      return null;
    }

    throw err;
  }
}
