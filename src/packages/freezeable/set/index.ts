import freeze from '../utils/freeze';
import isFrozen from '../utils/is-frozen';

/**
 * @private
 */
class FreezeableSet<T> extends Set<T> {
  override add(value: T): this {
    if (!this.isFrozen()) {
      super.add(value);
    }

    return this;
  }

  override clear(): void {
    if (!this.isFrozen()) {
      super.clear();
    }
  }

  override delete(value: T): boolean {
    return this.isFrozen() ? false : super.delete(value);
  }

  freeze(deep?: boolean): this {
    if (deep) {
      this.forEach(Object.freeze);
    }

    return freeze(this);
  }

  isFrozen(): boolean {
    return isFrozen(this);
  }
}

export default FreezeableSet;
