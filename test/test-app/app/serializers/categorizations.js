import { Serializer } from 'LUMEN_LOCAL';

class CategorizationsSerializer extends Serializer {
  hasOne = [
    'tag',
    'post'
  ];
}

export default CategorizationsSerializer;
