import { Model } from 'LUMEN_LOCAL';

class Shelf extends Model {
  static hasMany = {
    books: {
      inverse: 'shelves',
      through: 'placement',
      foreignKey: 'shelf_ref'
    }
  };
}

export default Shelf;
