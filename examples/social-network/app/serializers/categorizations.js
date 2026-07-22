import { Serializer } from 'lumen-framework';

class CategorizationsSerializer extends Serializer {
  hasOne = [
    'tag',
    'post'
  ];
}

export default CategorizationsSerializer;
