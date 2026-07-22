import { Model } from 'lumen-framework';

class Task extends Model {
  static belongsTo = {
    list: {
      inverse: 'tasks'
    }
  };
}

export default Task;
