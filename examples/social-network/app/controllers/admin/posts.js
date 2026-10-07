import PostsController from '../posts';

class AdminPostsController extends PostsController {
  // Admins may also move comments between posts and retag them — to-many
  // relationship writes, direct and through a join model (categorizations).
  params = [
    ...this.params,
    'comments',
    'tags'
  ];

  // An attribute admins may not write is a 400 here, rather than being
  // silently dropped as it is by default.
  rejectUnlistedAttributes = true;
}

export default AdminPostsController;
