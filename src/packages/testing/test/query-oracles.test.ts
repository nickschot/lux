import { it, describe, expect } from 'vitest';

import {
  hiddenButQueryable,
  interleavedNulls,
  listedResources,
  listingOf,
  sortProbes
} from '../utils/query-oracles';

describe('query oracles', () => {
  const listing = listingOf(
    'users',
    ['name', 'email', 'createdAt'],
    ['name', 'createdAt'],
    ['email']
  );

  const user = (id: string, attributes: Record<string, unknown>) => ({
    type: 'users',
    id,
    attributes
  });

  describe('listingOf()', () => {
    it('names the members as documents do', () => {
      expect(listing).to.deep.equal({
        type: 'users',
        attributes: ['name', 'email', 'created-at'],
        sortable: ['name', 'created-at'],
        filterable: ['email']
      });
    });
  });

  describe('listedResources()', () => {
    it("keeps the list's own records with attributes", () => {
      const resources = listedResources(
        {
          data: [
            user('1', { name: 'A' }),
            { type: 'posts', id: '2', attributes: {} },
            { type: 'users', id: '3' }
          ]
        },
        listing
      );

      expect(resources.map(({ id }) => id)).to.deep.equal(['1']);
    });

    it('finds none in a document without a list', () => {
      expect(listedResources({ data: user('1', {}) }, listing)).to.deep.equal(
        []
      );
      expect(listedResources(null, listing)).to.deep.equal([]);
    });
  });

  describe('hiddenButQueryable()', () => {
    it('reports an attribute left out that the route sorts or filters on', () => {
      const messages = hiddenButQueryable(
        [
          user('1', { name: 'A', email: 'a@x', 'created-at': 1 }),
          user('2', { name: 'B' })
        ],
        listing
      );

      expect(messages).to.deep.equal([
        'users 2 leave out `email`, which this route accepts as `filter`: ' +
          'the order or selection of its results reveals it',
        'users 2 leave out `created-at`, which this route accepts as ' +
          '`sort`: the order or selection of its results reveals it'
      ]);
    });

    it('ignores an attribute the route neither sorts nor filters on', () => {
      const narrow = listingOf('users', ['name', 'email'], ['name'], []);

      expect(
        hiddenButQueryable([user('1', { name: 'A' })], narrow)
      ).to.deep.equal([]);
    });

    it('accepts null, which the serializer outputs too', () => {
      expect(
        hiddenButQueryable(
          [user('1', { name: null, email: null, 'created-at': null })],
          listing
        )
      ).to.deep.equal([]);
    });
  });

  describe('sortProbes()', () => {
    it('picks sortable attributes that are null for some records only', () => {
      const probes = sortProbes(
        [
          user('1', { name: 'A', 'created-at': null }),
          user('2', { name: null, 'created-at': null })
        ],
        listing
      );

      expect(probes).to.deep.equal(['name']);
    });
  });

  describe('interleavedNulls()', () => {
    const sortedBy = (names: Array<string | null>) =>
      names.map((name, i) => user(String(i + 1), { name }));

    it('accepts nulls at the start or the end', () => {
      expect(
        interleavedNulls(sortedBy([null, null, 'A', 'B']), listing, 'name')
      ).to.equal(undefined);
      expect(
        interleavedNulls(sortedBy(['A', 'B', null]), listing, 'name')
      ).to.equal(undefined);
      expect(interleavedNulls(sortedBy(['A', 'B']), listing, 'name')).to.equal(
        undefined
      );
    });

    it('reports nulls between values', () => {
      expect(
        interleavedNulls(sortedBy(['A', null, 'B', null]), listing, 'name')
      ).to.equal(
        'sorting by `name` puts users 2, 4, which show it as null, between ' +
          'records that show a value: the order reveals values the response ' +
          'hides'
      );
    });

    it('reports nulls at both ends', () => {
      expect(
        interleavedNulls(sortedBy([null, 'A', null]), listing, 'name')
      ).to.be.a('string');
    });
  });
});
