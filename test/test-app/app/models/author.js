import { Model } from 'LUMEN_LOCAL';

class Author extends Model {
  static hasMany = {
    // No `foreignKey`: it is the inverse belongsTo's (`written_by`).
    books: {
      inverse: 'writer'
    }
  };
}

export default Author;
