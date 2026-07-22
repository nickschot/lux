/* eslint-disable @typescript-eslint/no-explicit-any --
 * A ChangeSet stores a record's pending attribute and relationship values,
 * which are heterogeneous and dynamic (typed `any`/`Object` in the original
 * Flow). The `any` value type is what lets attribute getters/setters and the
 * relationship helpers round-trip those values.
 */
import type { Model } from '../index';
import entries from '../../../utils/entries';
import mapToObject from '../../../utils/map-to-object';

class ChangeSet extends Map<string, any> {
  declare isPersisted: boolean;

  constructor(data: Record<string, unknown> = {}) {
    super(entries(data));

    this.isPersisted = false;
  }

  override set(key: string, value: any): this {
    if (!this.isPersisted) {
      super.set(key, value);
    }

    return this;
  }

  persist(group?: Array<ChangeSet>): this {
    if (group) {
      group.forEach(changeSet => changeSet.unpersist());
    }

    this.isPersisted = true;

    return this;
  }

  unpersist(): this {
    this.isPersisted = false;
    return this;
  }

  applyTo(target: Model): ChangeSet {
    const instance = new ChangeSet(mapToObject(this));

    target.changeSets.unshift(instance);

    return instance;
  }
}

export default ChangeSet;
