import UsersSerializer from '../users';

// Differs from the public serializer on purpose, so tests can tell which one
// formatted a user (e.g. as an included resource of an `/admin/*` request):
// one attribute more, and fewer relationships.
class AdminUsersSerializer extends UsersSerializer {
  attributes = [
    ...this.attributes,
    'createdAt'
  ];

  hasMany = [
    'posts',
    'comments'
  ];
}

export default AdminUsersSerializer;
