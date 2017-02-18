// @flow
import Serializer from '../index';
import type { ObjectMap } from '../../../interfaces';
import { getTestApp } from '../../../../test/utils/get-test-app';

const DOMAIN = 'http://localhost:4000';

const linkFor = (type, id) => (
  id ? `${DOMAIN}/${type}/${id}` : `${DOMAIN}/${type}`
);

const createSorter = field => {
  const extractValue = (src: ObjectMap<string>) => {
    const value = src[field];

    if (typeof value === 'string') {
      const asNum = Number.parseInt(value, 10);

      return Number.isFinite(asNum) ? asNum : value.charCodeAt(0);
    }

    return 0;
  };

  return (direction = 'asc', tiebreaker = () => 0) => (
    (a: ObjectMap<string>, b: ObjectMap<string>) => {
      let result = 0;

      if (direction === 'asc') {
        result = extractValue(a) - extractValue(b);
      } else {
        result = extractValue(b) - extractValue(a);
      }

      return result || tiebreaker(a, b);
    }
  );
};

describe('module "serializer"', () => {
  describe('class Serializer', () => {
    let Post;
    let subject;
    let adminSubject;

    beforeAll(async () => {
      const { store, serializers } = await getTestApp();

      const hasOne = [
        'user',
        'image',
      ];

      const hasMany = [
        'tags',
        'comments',
        'reactions',
      ];

      const attributes = [
        'body',
        'title',
        'createdAt',
        'updatedAt',
      ];

      class TestSerializer extends Serializer {
        hasOne = hasOne;
        hasMany = hasMany;
        attributes = attributes;
      }

      class AdminTestSerializer extends Serializer {
        hasOne = hasOne;
        hasMany = hasMany;
        attributes = attributes;
      }

      Post = store.modelFor('post');

      subject = new TestSerializer({
        model: Post,
        parent: serializers.get('application'),
        namespace: '',
      });

      adminSubject = new AdminTestSerializer({
        model: Post,
        parent: serializers.get('admin/application'),
        namespace: 'admin',
      });
    });

    describe('#format()', () => {
      const byId = createSorter('id');
      const byType = createSorter('type');
      const { prototype: { toISOString } } = Date;

      beforeAll(() => {
        global.Date.prototype.toISOString = function trap() {
          const date = new Date(this);

          date.setUTCHours(0, 0, 0, 0);

          const result = toISOString.call(date);

          return `${result.substr(0, result.length - 4)}000Z`;
        };
      });

      afterAll(() => {
        global.Date.prototype.toISOString = toISOString;
      });

      it('works with a single instance of `Model`', async () => {
        const id = 1;
        const post = await Post.find(id);
        const result = await subject.format({
          data: post,
          domain: DOMAIN,
          include: [],
          links: {
            self: linkFor('posts', id),
          },
        });

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });

      it('works with an array of `Model` instances', async () => {
        const posts = await Post.page(1).order('createdAt');
        const result = await subject.format({
          data: posts,
          domain: DOMAIN,
          include: [],
          links: {
            self: linkFor('posts')
          }
        });

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });

      it('can build namespaced links', async () => {
        const posts = await Post.page(1).order('createdAt');
        const result = await adminSubject.format({
          data: posts,
          domain: DOMAIN,
          include: [
            'user',
            'comments',
          ],
          links: {
            self: linkFor('admin/posts'),
          },
        });

        result.included.sort(byType('asc', byId('asc')));

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });

      it('supports including a has-one relationship', async () => {
        const id = 18;
        const post = await Post.find(id).include('image');
        const result = await subject.format({
          data: post,
          domain: DOMAIN,
          include: [
            'image',
          ],
          links: {
            self: linkFor('posts', id),
          },
        });

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });

      it('supports including belongs-to relationships', async () => {
        const id = 1;
        const post = await Post.find(id).include('user');
        const result = await subject.format({
          data: post,
          domain: DOMAIN,
          include: [
            'user',
          ],
          links: {
            self: linkFor('posts', id),
          },
        });

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });

      it('supports including a one-to-many relationship', async () => {
        const id = 2;
        const post = await Post.find(id).include('comments');
        const result = await subject.format({
          data: post,
          domain: DOMAIN,
          include: [
            'comments',
          ],
          links: {
            self: linkFor('posts', id),
          },
        });

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });

      it('supports including a many-to-many relationship', async () => {
        const id = 8;
        const post = await Post.find(id).include('tags');
        const result = await subject.format({
          data: post,
          domain: DOMAIN,
          include: [
            'tags',
          ],
          links: {
            self: linkFor('posts', id),
          },
        });

        result.included.sort(byId('asc'));
        result.data.relationships.tags.data.sort(byId('asc'));

        expect(JSON.stringify(result, null, 2)).toMatchSnapshot();
      });
    });
  });
});
