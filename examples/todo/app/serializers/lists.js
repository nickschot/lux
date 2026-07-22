import { Serializer } from 'lumen-framework';

class ListsSerializer extends Serializer {
  attributes = [
    'name',
    'createdAt',
    'updatedAt'
  ];

  hasMany = [
    'tasks'
  ];
}

export default ListsSerializer;
