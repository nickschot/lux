import { Serializer } from 'LUMEN_LOCAL';

class ReactionsSerializer extends Serializer {
  attributes = [
    'type',
    'createdAt'
  ];

  hasOne = [
    'post',
    'user',
    'comment'
  ];
}

export default ReactionsSerializer;
