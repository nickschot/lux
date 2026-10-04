import ApplicationController from '../application';

// What a member sees: private posts, and the comments on them, are hidden
// from every request in the namespace — primary data, linkage, `include` and
// the relationships a write may reference alike.
class MembersApplicationController extends ApplicationController {
  static visibility = {
    posts: query => query.isPublic(),

    comments: query => query.whereRaw(
      'comments.post_id IN (SELECT id FROM posts WHERE is_public = ?)',
      [true]
    )
  };
}

export default MembersApplicationController;
