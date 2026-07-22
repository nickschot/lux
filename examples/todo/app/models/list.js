import { Model } from 'lumen-framework';

class List extends Model {
  static hasMany = {
    tasks: {
      inverse: 'list'
    }
  };
}

export default List;
