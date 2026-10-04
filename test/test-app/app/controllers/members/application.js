import ApplicationController from '../application';

// Members also lose the comments on private posts — on top of the root rules,
// which hide the posts themselves.
class MembersApplicationController extends ApplicationController {
  static visibility = {
    ...super.visibility,

    comments: query => query.whereRaw(
      'comments.post_id IN (SELECT id FROM posts WHERE is_public = ?)',
      [true]
    )
  };
}

export default MembersApplicationController;
