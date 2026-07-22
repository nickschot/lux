import { Serializer } from 'lumen-framework';

class FriendshipsSerializer extends Serializer {
  attributes = [
    'followerId',
    'followeeId',
    'createdAt',
    'updatedAt'
  ];
}

export default FriendshipsSerializer;
