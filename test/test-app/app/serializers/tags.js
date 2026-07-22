import { Serializer } from 'LUMEN_LOCAL';

class TagsSerializer extends Serializer {
  attributes = [
    'name'
  ];

  hasMany = [
    'posts'
  ];
}

export default TagsSerializer;
