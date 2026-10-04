import { Controller } from 'LUMEN_LOCAL';

class PostsController extends Controller {
  params = [
    'user',
    'body',
    'title',
    'image',
    'isPublic'
  ];
}

export default PostsController;
