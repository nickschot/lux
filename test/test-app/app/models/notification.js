import { Model } from 'LUMEN_LOCAL';

class Notification extends Model {
  static belongsTo = {
    recipient: {
      model: 'user',
      inverse: 'notifications'
    }
  };
}

export default Notification;
