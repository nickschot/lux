import { Model } from 'LUMEN_LOCAL';

class Book extends Model {
  static belongsTo = {
    writer: {
      model: 'author',
      inverse: 'books',
      foreignKey: 'written_by'
    }
  };

  static hasMany = {
    shelves: {
      inverse: 'books',
      through: 'placement',
      foreignKey: 'item_id'
    }
  };
}

export default Book;
