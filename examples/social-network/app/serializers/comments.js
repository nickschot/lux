import { Serializer } from 'lumen-framework';

class CommentsSerializer extends Serializer {
  attributes = [
    'edited',
    'message',
    'createdAt',
    'updatedAt'
  ];

  hasOne = [
    'post',
    'user'
  ];

  hasMany = [
    'reactions'
  ];
}

export default CommentsSerializer;
