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

  // `type` is a field name JSON:API forbids; kept to test the opt-out.
  allowReservedNames = true;
}

export default ReactionsSerializer;
