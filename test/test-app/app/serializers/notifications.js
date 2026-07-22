import { Serializer } from 'LUMEN_LOCAL';

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
