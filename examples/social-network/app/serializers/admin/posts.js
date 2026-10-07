import PostsSerializer from '../posts';

// Only admins can see which posts are private; everyone else never receives a
// private post at all (see the visibility rules in app/controllers).
class AdminPostsSerializer extends PostsSerializer {
  attributes = [
    ...this.attributes,
    'isPublic'
  ];
}

export default AdminPostsSerializer;
