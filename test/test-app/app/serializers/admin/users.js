import UsersSerializer from '../users';

// Admins see one attribute more than the public serializer, so tests can
// tell which serializer formatted a user (e.g. as an included resource of an
// `/admin/*` request).
class AdminUsersSerializer extends UsersSerializer {
  attributes = [
    ...this.attributes,
    'createdAt'
  ];
}

export default AdminUsersSerializer;
