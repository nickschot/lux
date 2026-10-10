import { describe, it, expect } from 'vitest';

import validateRelationships from '../utils/validate-relationships';
import type { ModelClass } from '../interfaces';
import type { RelationshipOptions } from '../relationship';
import { getTestApp } from '../../../../test/utils/get-test-app';

// Just what the check reads of a model: its name, table, columns and
// resolved relationships.
type Fake = {
  name: string;
  tableName: string;
  attributeNames: Array<string>;
  relationships: Record<string, Partial<RelationshipOptions>>;
};

function models(...fakes: Array<Fake>): Array<ModelClass> {
  const byName = new Map<string, ModelClass>();

  fakes.forEach(fake => {
    byName.set(fake.name, {
      name: fake.name,
      tableName: fake.tableName,
      attributeNames: fake.attributeNames,
      relationshipNames: Object.keys(fake.relationships),
      relationshipFor: (key: string) => {
        const opts = fake.relationships[key];

        if (!opts) {
          return undefined;
        }

        // Relationships name their models; resolve them as boot does.
        return {
          ...opts,
          model: byName.get(opts.model as unknown as string),
          through: opts.through
            ? byName.get(opts.through as unknown as string)
            : undefined
        };
      }
    } as unknown as ModelClass);
  });

  return Array.from(byName.values());
}

const user = (relationships: Fake['relationships']): Fake => ({
  name: 'User',
  tableName: 'users',
  attributeNames: ['id', 'name'],
  relationships
});

const post = (relationships: Fake['relationships']): Fake => ({
  name: 'Post',
  tableName: 'posts',
  attributeNames: ['id', 'title', 'userId'],
  relationships
});

const belongsToUser = (inverse: string) => ({
  type: 'belongsTo' as const,
  model: 'User' as never,
  inverse,
  foreignKey: 'user_id'
});

const hasManyPosts = (inverse: string) => ({
  type: 'hasMany' as const,
  model: 'Post' as never,
  inverse,
  foreignKey: 'user_id'
});

const problemsOf = (list: Array<ModelClass>): string => {
  try {
    validateRelationships(list);
  } catch (err) {
    return (err as Error).message;
  }

  return '';
};

describe('module "database" #validateRelationships()', () => {
  it("accepts the test-app's models", async () => {
    const app = await getTestApp();

    expect(() =>
      validateRelationships(app.models.values() as Iterable<ModelClass>)
    ).not.to.throw();
  });

  it('accepts a belongsTo paired with a hasMany', () => {
    expect(
      problemsOf(
        models(
          user({ posts: hasManyPosts('user') }),
          post({ user: belongsToUser('posts') })
        )
      )
    ).to.equal('');
  });

  it('names an inverse that does not exist, and what does', () => {
    // What `lumen generate` wrote before #94.
    expect(
      problemsOf(
        models(
          user({ posts: hasManyPosts('user') }),
          post({ user: belongsToUser('post') })
        )
      )
    ).to.include(
      "Post.belongsTo.user has inverse 'post', but User has no " +
        "relationship 'post' (it has: posts)"
    );
  });

  it('rejects a relationship without an inverse', () => {
    expect(
      problemsOf(
        models(
          user({ posts: hasManyPosts('user') }),
          post({ user: { ...belongsToUser('posts'), inverse: undefined } })
        )
      )
    ).to.include('Post.belongsTo.user has no `inverse`');
  });

  it('rejects an inverse that points at another model', () => {
    const comment: Fake = {
      name: 'Comment',
      tableName: 'comments',
      attributeNames: ['id', 'userId'],
      relationships: {
        user: { ...belongsToUser('posts') }
      }
    };

    expect(
      problemsOf(
        models(
          user({ posts: hasManyPosts('user') }),
          post({ user: belongsToUser('posts') }),
          comment
        )
      )
    ).to.include(
      "Comment.belongsTo.user has inverse 'posts', but User.hasMany.posts " +
        'points at Post, not Comment'
    );
  });

  it('rejects two sides of the same kind', () => {
    const message = problemsOf(
      models(
        user({ post: { ...belongsToUser('user'), model: 'Post' as never } }),
        post({ user: belongsToUser('post') })
      )
    );

    expect(message).to.include('is a belongsTo too');
  });

  it('rejects a missing foreign key column', () => {
    expect(
      problemsOf(
        models(
          user({ posts: { ...hasManyPosts('user'), foreignKey: 'author_id' } }),
          post({ user: { ...belongsToUser('posts'), foreignKey: 'author_id' } })
        )
      )
    ).to.include(
      'User.hasMany.posts needs the foreign key column `author_id` on ' +
        '`posts`, which has no such column'
    );
  });

  it('rejects two sides that name different foreign keys', () => {
    expect(
      problemsOf(
        models(
          user({ posts: { ...hasManyPosts('user'), foreignKey: 'author_id' } }),
          post({ user: belongsToUser('posts') })
        )
      )
    ).to.include(
      'User.hasMany.posts has foreign key `author_id`, but ' +
        'Post.belongsTo.user has `user_id`; both sides must name the same ' +
        'column'
    );
  });

  it('checks both sides of a many-to-many through the same join model', () => {
    const tag = (through: string): Fake => ({
      name: 'Tag',
      tableName: 'tags',
      attributeNames: ['id'],
      relationships: {
        posts: {
          type: 'hasMany',
          model: 'Post' as never,
          inverse: 'tags',
          through: through as never,
          foreignKey: 'tag_id'
        }
      }
    });
    const join = (name: string, tableName: string): Fake => ({
      name,
      tableName,
      attributeNames: ['id', 'postId', 'tagId'],
      relationships: {}
    });
    const postWithTags = post({
      tags: {
        type: 'hasMany',
        model: 'Tag' as never,
        inverse: 'posts',
        through: 'Categorization' as never,
        foreignKey: 'post_id'
      }
    });

    expect(
      problemsOf(
        models(
          postWithTags,
          tag('Categorization'),
          join('Categorization', 'categorizations')
        )
      )
    ).to.equal('');

    expect(
      problemsOf(
        models(
          postWithTags,
          tag('Tagging'),
          join('Categorization', 'categorizations'),
          join('Tagging', 'taggings')
        )
      )
    ).to.include('Tag.hasMany.posts is not a hasMany through Categorization');
  });
});
