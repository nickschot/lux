import { Model } from 'LUMEN_LOCAL';

class Image extends Model {
  static belongsTo = {
    post: {
      inverse: 'image'
    }
  };
}

export default Image;
