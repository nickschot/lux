import { it, describe, expect } from 'vitest';

import modelTemplate from '../templates/model';

describe('module "cli"', () => {
  describe('template model', () => {
    it('points a belongs-to back at the plural has-many', () => {
      const source = modelTemplate('post', ['title:string', 'user:belongs-to']);

      expect(source).to.match(
        /static belongsTo = \{\s+user: \{\s+inverse: 'posts'/
      );
    });

    it('points a has-many back at the singular owner', () => {
      const source = modelTemplate('user', ['name:string', 'posts:has-many']);

      expect(source).to.match(
        /static hasMany = \{\s+posts: \{\s+inverse: 'user'/
      );
    });

    it('points a has-one back at the singular owner', () => {
      const source = modelTemplate('post', ['image:has-one']);

      expect(source).to.match(
        /static hasOne = \{\s+image: \{\s+inverse: 'post'/
      );
    });

    it('camelizes a multi-word model name', () => {
      const source = modelTemplate('blog-post', ['author:belongs-to']);

      expect(source).to.match(/class BlogPost extends Model/);
      expect(source).to.match(/inverse: 'blogPosts'/);
    });
  });
});
