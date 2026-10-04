import { Controller } from 'LUMEN_LOCAL';

class MembersPostsController extends Controller {
  params = [
    'user',
    'body',
    'title',
    'isPublic'
  ];
}

export default MembersPostsController;
