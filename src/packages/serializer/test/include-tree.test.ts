import { it, describe, beforeAll, expect } from 'vitest';

import {
  createIncludeTree,
  enumerateIncludePaths
} from '../utils/include-tree';
import type { IncludeTree } from '../utils/include-tree';
import type { ModelClass } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

// Maps are compared as plain nested objects for readable assertions.
const toObject = (tree: IncludeTree): Record<string, unknown> =>
  Object.fromEntries(
    Array.from(tree, ([name, children]) => [name, toObject(children)])
  );

describe('module "serializer/utils/include-tree"', () => {
  describe('#createIncludeTree()', () => {
    it('returns an empty tree without paths', () => {
      expect(toObject(createIncludeTree())).to.deep.equal({});
      expect(toObject(createIncludeTree([]))).to.deep.equal({});
    });

    it('nests dotted paths and implies their intermediates', () => {
      const tree = createIncludeTree([
        'comments.user',
        'user',
        'comments.post'
      ]);

      expect(toObject(tree)).to.deep.equal({
        comments: { user: {}, post: {} },
        user: {}
      });
    });

    it('merges duplicate and overlapping paths', () => {
      const tree = createIncludeTree([
        'comments',
        'comments.reactions.user',
        'comments.reactions'
      ]);

      expect(toObject(tree)).to.deep.equal({
        comments: { reactions: { user: {} } }
      });
    });

    it('preserves request order', () => {
      const tree = createIncludeTree(['tags', 'user', 'comments']);

      expect(Array.from(tree.keys())).to.deep.equal([
        'tags',
        'user',
        'comments'
      ]);
    });

    it('ignores empty segments', () => {
      expect(toObject(createIncludeTree(['comments..user.']))).to.deep.equal({
        comments: { user: {} }
      });
    });
  });

  describe('#enumerateIncludePaths()', () => {
    let Post: ModelClass;
    let Image: ModelClass;

    beforeAll(async () => {
      const { models } = await getTestApp();

      Post = models.get('post') as ModelClass;
      Image = models.get('image') as ModelClass;
    });

    it('returns nothing at depth 0', () => {
      expect(enumerateIncludePaths(Post, ['user'], 0)).to.deep.equal([]);
    });

    it('returns the relationships themselves at depth 1', () => {
      expect(enumerateIncludePaths(Post, ['user', 'image'], 1)).to.deep.equal([
        'user',
        'image'
      ]);
    });

    it("follows each related serializer's relationships", () => {
      // ImagesSerializer: hasOne = ['post'];
      // PostsSerializer: hasOne = ['user', 'image'], hasMany = ['comments',
      // 'reactions', 'tags'].
      expect(enumerateIncludePaths(Image, ['post'], 3)).to.deep.equal([
        'post',
        'post.user',
        'post.user.posts',
        'post.user.comments',
        'post.user.followees',
        'post.user.followers',
        'post.user.reactions',
        'post.image',
        'post.image.post',
        'post.comments',
        'post.comments.post',
        'post.comments.user',
        'post.comments.reactions',
        'post.reactions',
        'post.reactions.post',
        'post.reactions.user',
        'post.reactions.comment',
        'post.tags',
        'post.tags.posts'
      ]);
    });

    it('skips names that are not relationships of the model', () => {
      expect(enumerateIncludePaths(Post, ['nope', 'user'], 1)).to.deep.equal([
        'user'
      ]);
    });
  });
});
