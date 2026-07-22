import { Model } from 'LUMEN_LOCAL';

class Categorization extends Model {
  static belongsTo = {
    tag: {
      inverse: 'posts'
    },

    post: {
      inverse: 'tags'
    }
  };
}

export default Categorization;
