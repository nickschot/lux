import { Serializer } from 'lumen-framework';

class NotificationsSerializer extends Serializer {
  attributes = [
    'unread',
    'message',
    'createdAt',
    'updatedAt'
  ];

  hasOne = [
    'recipient'
  ];
}

export default NotificationsSerializer;
