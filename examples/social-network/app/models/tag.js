import { Model } from 'lumen-framework';

class Tag extends Model {
  static hasMany = {
    posts: {
      inverse: 'tags',
      through: 'categorization'
    }
  };
}

export default Tag;
