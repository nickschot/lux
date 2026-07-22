import { Serializer } from 'LUMEN_LOCAL';

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
