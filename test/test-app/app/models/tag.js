import { Model } from 'LUMEN_LOCAL';

class Tag extends Model {
  static hasMany = {
    posts: {
      inverse: 'tags',
      through: 'categorization'
    }
  };
}

export default Tag;
