import { Controller } from 'lumen-framework';

class MembersPostsController extends Controller {
  params = [
    'user',
    'body',
    'title',
    'isPublic'
  ];
}

export default MembersPostsController;
