import { Model } from 'lumen-framework';

class Notification extends Model {
  static belongsTo = {
    recipient: {
      model: 'user',
      inverse: 'notifications'
    }
  };
}

export default Notification;
