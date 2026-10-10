import { it, describe, expect } from 'vitest';

import identifiersIn from '../utils/identifiers-in';

describe('module "testing" #identifiersIn()', () => {
  it('names primary data, included resources and their linkage', () => {
    expect(
      identifiersIn({
        data: [
          {
            type: 'posts',
            id: '1',
            relationships: {
              user: { data: { type: 'users', id: '2' } },
              comments: {
                data: [
                  { type: 'comments', id: '3' },
                  { type: 'comments', id: '4' }
                ]
              },
              image: { data: null },
              reactions: { links: { related: '/posts/1/reactions' } }
            }
          }
        ],
        included: [
          {
            type: 'comments',
            id: '3',
            relationships: { post: { data: { type: 'posts', id: '5' } } }
          }
        ]
      })
    ).to.deep.equal([
      { type: 'posts', id: '1' },
      { type: 'users', id: '2' },
      { type: 'comments', id: '3' },
      { type: 'comments', id: '4' },
      { type: 'comments', id: '3' },
      { type: 'posts', id: '5' }
    ]);
  });

  it("names a relationship endpoint's linkage", () => {
    expect(identifiersIn({ data: [{ type: 'tags', id: '7' }] })).to.deep.equal([
      { type: 'tags', id: '7' }
    ]);
    expect(identifiersIn({ data: { type: 'users', id: 8 } })).to.deep.equal([
      { type: 'users', id: '8' }
    ]);
  });

  it('names nothing in an empty or non-document body', () => {
    expect(identifiersIn({ data: null })).to.deep.equal([]);
    expect(identifiersIn({ data: [] })).to.deep.equal([]);
    expect(identifiersIn(null)).to.deep.equal([]);
    expect(identifiersIn('text')).to.deep.equal([]);
  });
});
