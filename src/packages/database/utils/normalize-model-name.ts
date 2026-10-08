import { dasherize, singularize } from 'inflection';

import { compose } from '../../../utils/compose';
import underscore from '../../../utils/underscore';

/** @internal */
export default compose(singularize, dasherize, underscore);
