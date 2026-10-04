import { it, describe, expect } from 'vitest';

import warnQueryParamNames from '../utils/warn-query-param-names';
import type Controller from '../../controller';
import type Logger from '../../logger';

describe('module "application" #warnQueryParamNames()', () => {
  const warningsFor = (query: Array<string>) => {
    const warnings: Array<string> = [];

    warnQueryParamNames(
      new Map([['posts', { query } as unknown as Controller]]),
      { warn: (message: string) => warnings.push(message) } as Logger
    );

    return warnings;
  };

  it('warns about names made only of a-z', () => {
    const [warning] = warningsFor(['search', 'userId', 'q']);

    expect(warning).to.include("'posts'").and.include('(search, q)');
  });

  it('accepts names with any other character', () => {
    expect(warningsFor(['userId', 'search-term', 'search_2'])).to.be.empty;
  });
});
