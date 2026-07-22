import { Serializer } from 'lumen-framework';

class PostsSerializer extends Serializer {
  attributes = [
    'body',
    'title',
    'createdAt',
    'updatedAt'
  ];

  hasOne = [
    'user'
  ];

  hasMany = [
    'comments',
    'reactions',
    'tags'
  ];
}

export default PostsSerializer;
