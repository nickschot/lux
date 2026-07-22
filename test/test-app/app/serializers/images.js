import { Serializer } from 'LUMEN_LOCAL';

class ImagesSerializer extends Serializer {
  attributes = [
    'url'
  ];

  hasOne = [
    'post'
  ];
}

export default ImagesSerializer;
