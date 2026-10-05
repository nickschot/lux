import PostsController from '../posts';

class AdminPostsController extends PostsController {
  // Admins may also move comments between posts and retag them — the
  // reference app's to-many relationship writes, direct and through a join
  // model (categorizations).
  params = [
    'user',
    'body',
    'title',
    'image',
    'isPublic',
    'comments',
    'tags'
  ];

  // The opposite of the defaults, so both ways of handling a member the
  // model has but `params` does not list are covered.
  rejectUnlistedAttributes = true;

  rejectUnlistedRelationships = false;
}

export default AdminPostsController;
