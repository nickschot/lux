import { Controller } from 'LUMEN_LOCAL';

class PostsController extends Controller {
  params = [
    'user',
    'body',
    'title',
    'image',
    'isPublic'
  ];

  featured() {
    return this.model.where({ isPublic: true }).limit(2);
  }

  topRated(request) {
    return this.index(request).where({ isPublic: true });
  }
}

export default PostsController;
