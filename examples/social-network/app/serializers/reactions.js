import { Serializer } from 'lumen-framework';

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
