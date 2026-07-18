import freeze from '../utils/freeze';
import isFrozen from '../utils/is-frozen';

/**
 * @private
 */
class FreezeableMap<K, V> extends Map<K, V> {
  override set(key: K, value: V): this {
    if (!this.isFrozen()) {
      super.set(key, value);
    }

    return this;
  }

  override clear(): void {
    if (!this.isFrozen()) {
      super.clear();
    }
  }

  override delete(key: K): boolean {
    return this.isFrozen() ? false : super.delete(key);
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

export default FreezeableMap;
