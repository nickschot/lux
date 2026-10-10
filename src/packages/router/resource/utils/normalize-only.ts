import { BUILT_IN_ACTIONS, type BuiltInAction } from '../../../controller';

/** @internal */
export default function normalizeOnly(
  only: Array<BuiltInAction>
): Array<BuiltInAction> {
  return only.filter(action => BUILT_IN_ACTIONS.indexOf(action) >= 0);
}
