import { it, describe, expect } from 'vitest';

import validate from '../model/utils/validate';
import { ValidationError } from '../validation';
import ErrorList from '../../server/errors/error-list';
import type { Model } from '../index';

// A stand-in with just what `validate()` reads.
const instanceWith = (
  attributes: Record<string, unknown>,
  validates: Record<string, (value: unknown) => boolean>
) =>
  ({
    dirtyAttributes: new Map(Object.entries(attributes)),
    constructor: { validates }
  }) as unknown as Model;

describe('module "database/model" #validate()', () => {
  const validates = {
    title: (value: unknown) => typeof value === 'string' && value.length > 3,
    body: (value: unknown) => typeof value === 'string' && value.length > 0
  };

  it('passes valid attributes', () => {
    expect(validate(instanceWith({ title: 'Long', body: 'x' }, validates))).to
      .be.true;
  });

  it('throws a ValidationError for a single invalid attribute', () => {
    expect(() =>
      validate(instanceWith({ title: 'No', body: 'x' }, validates))
    ).to.throw(ValidationError);
  });

  it('reports every invalid attribute at once', () => {
    expect(() => validate(instanceWith({ title: 'No', body: '' }, validates)))
      .to.throw(ErrorList)
      .with.property('errors')
      .that.satisfies((errors: Array<{ source: { pointer: string } }>) =>
        ['/data/attributes/title', '/data/attributes/body'].every(pointer =>
          errors.some(error => error.source.pointer === pointer)
        )
      );
  });
});
