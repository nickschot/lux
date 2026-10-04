import PostsController from '../posts';

class AdminPostsController extends PostsController {
  // Admins may also move comments between posts — the reference app's
  // to-many relationship write.
  params = [
    'user',
    'body',
    'title',
    'image',
    'isPublic',
    'comments'
  ];
}

export default AdminPostsController;
