import { Serializer } from 'LUMEN_LOCAL';

class FriendshipsSerializer extends Serializer {
  attributes = [
    'followerId',
    'followeeId',
    'createdAt',
    'updatedAt'
  ];
}

export default FriendshipsSerializer;
