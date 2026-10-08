import { Model } from 'LUMEN_LOCAL';

class Placement extends Model {
  static belongsTo = {
    book: {
      inverse: 'shelves',
      foreignKey: 'item_id'
    },

    shelf: {
      inverse: 'books',
      foreignKey: 'shelf_ref'
    }
  };
}

export default Placement;
