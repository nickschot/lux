import UsersSerializer from '../users';

// A serializer per namespace: admins also see a user's email address and when
// they signed up. `include=user` under /admin uses this serializer too.
class AdminUsersSerializer extends UsersSerializer {
  attributes = [
    ...this.attributes,
    'email',
    'createdAt'
  ];
}

export default AdminUsersSerializer;
