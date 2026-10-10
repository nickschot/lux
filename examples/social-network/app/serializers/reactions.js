import { Serializer } from 'lumen-framework';

class ReactionsSerializer extends Serializer {
  attributes = [
    'kind',
    'createdAt'
  ];

  hasOne = [
    'post',
    'user',
    'comment'
  ];
}

export default ReactionsSerializer;
