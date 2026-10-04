import { it, describe, expect } from 'vitest';

import normalizeDocument from '../utils/normalize-document';

describe('module "server/request/parser" #normalizeDocument()', () => {
  it('camelizes attribute and relationship names', () => {
    expect(
      normalizeDocument({
        data: {
          type: 'posts',
          attributes: { 'is-public': true },
          relationships: { 'blog-author': { data: null } }
        }
      })
    ).to.deep.equal({
      data: {
        type: 'posts',
        attributes: { isPublic: true },
        relationships: { blogAuthor: { data: null } }
      }
    });
  });

  it('leaves values as sent', () => {
    const date = '2020-01-01T00:00:00.000Z';
    const document = {
      data: {
        id: '1',
        type: 'posts',
        attributes: {
          title: date,
          settings: { 'snake_case-key': '123' },
          list: ['1', '2']
        },
        relationships: {
          tags: { data: [{ id: '2', type: 'tags' }] }
        }
      },
      meta: { 'client-id': 'abc' }
    };

    expect(normalizeDocument(document)).to.deep.equal(document);
  });

  it('passes anything else through for validation', () => {
    expect(normalizeDocument({ data: [] })).to.deep.equal({ data: [] });
    expect(normalizeDocument({ meta: {} })).to.deep.equal({ meta: {} });
  });
});
