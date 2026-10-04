import { it, describe, beforeAll, expect } from 'vitest';

import loadLinkage from '../utils/load-linkage';
import type { Model, ModelClass } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';
import { getRelated } from '../../../../test/utils/get-related';

const idsOf = (value: Model | Array<Model> | null | undefined) => {
  if (Array.isArray(value)) {
    return value.map(record => String(record.getPrimaryKey())).sort();
  }

  return value ? String(value.getPrimaryKey()) : null;
};

const sorted = (value: Array<string> | string | null) =>
  Array.isArray(value) ? [...value].sort() : value;

describe('module "serializer/utils/load-linkage"', () => {
  let models: Map<string, ModelClass>;

  beforeAll(async () => {
    ({ models } = (await getTestApp()) as unknown as {
      models: Map<string, ModelClass>;
    });
  });

  it('returns an empty map without records', async () => {
    const Post = models.get('post') as ModelClass;
    const linkage = await loadLinkage(Post, [], ['user', 'comments']);

    expect(linkage.size).to.equal(0);
  });

  it('defaults to-many linkage to [] and to-one linkage to null', async () => {
    const Post = models.get('post') as ModelClass;
    // A record that does not exist in the database has no related records.
    const ghost = Reflect.construct(Post, [{ id: -1 }]) as Model;
    const linkage = await loadLinkage(
      Post,
      [ghost],
      ['user', 'image', 'comments', 'tags', 'nope']
    );

    expect(linkage.get('-1')).to.deep.equal({
      user: null,
      image: null,
      comments: [],
      tags: [],
      nope: null
    });
  });

  it('resolves a belongs-to whose record no longer exists to null', async () => {
    const Comment = models.get('comment') as ModelClass;
    const Post = models.get('post') as ModelClass;
    const Action = models.get('action') as ModelClass;
    const [{ max }] = (await Post.table().max(
      `${Post.primaryKey} as max`
    )) as Array<{ max: number }>;
    const comment = (await Comment.create({
      message: 'dangling foreign key',
      postId: Number(max) + 1000
    })) as Model;

    try {
      const linkage = await loadLinkage(Comment, [comment], ['post', 'user']);

      expect(linkage.get(String(comment.getPrimaryKey()))).to.deep.equal({
        post: null,
        user: null
      });
    } finally {
      await Action.table()
        .where({
          trackable_id: comment.getPrimaryKey(),
          trackable_type: 'Comment'
        })
        .del();
      await comment.destroy();
    }
  });

  // The oracle for every relationship shape the test-app serializes
  // (belongs-to, belongs-to a custom model, has-one, has-many, has-many-through,
  // self-referential has-many-through): batch-loaded linkage must equal what
  // the lazy relationship getters load one record at a time.
  //
  // Only relationships a serializer declares are checked — those are the ones
  // linkage is loaded for — which also skips `comment.actions`, a polymorphic
  // relationship the framework does not support (its getter throws).
  [
    'post',
    'comment',
    'user',
    'tag',
    'reaction',
    'image',
    'notification'
  ].forEach(name => {
    it(`matches the relationship getters for "${name}"`, async () => {
      const model = models.get(name) as ModelClass;
      const { hasOne, hasMany } = model.serializer;
      const relationships = [...hasOne, ...hasMany];
      let fixture: Model | undefined;

      // The seed creates no notifications.
      if (name === 'notification') {
        const User = models.get('user') as ModelClass;
        const [recipient] = (await User.select(User.primaryKey).limit(
          1
        )) as unknown as Array<Model>;

        fixture = (await model.create({
          message: 'load-linkage fixture',
          recipientId: recipient.getPrimaryKey()
        })) as Model;
      }

      try {
        const records = (await model
          .select(model.primaryKey)
          .limit(15)) as unknown as Array<Model>;

        expect(relationships.length).to.be.greaterThan(0);
        expect(records.length).to.be.greaterThan(0);

        const linkage = await loadLinkage(model, records, relationships);

        await expectLinkageToMatchGetters(
          model,
          records,
          relationships,
          linkage
        );
      } finally {
        await fixture?.destroy();
      }
    });
  });

  async function expectLinkageToMatchGetters(
    model: ModelClass,
    records: Array<Model>,
    relationships: Array<string>,
    linkage: Awaited<ReturnType<typeof loadLinkage>>
  ) {
    for (const record of records) {
      // Fresh instances, so every getter really goes to the database.
      const fresh = (await model.find(record.getPrimaryKey())) as Model;
      const actual = linkage.get(String(record.getPrimaryKey()));

      for (const relationship of relationships) {
        const expected = idsOf(await getRelated(fresh, relationship));

        expect(
          sorted(actual?.[relationship] ?? null),
          `${model.resourceName}#${record.getPrimaryKey()}.${relationship}`
        ).to.deep.equal(expected);
      }
    }
  }
});
