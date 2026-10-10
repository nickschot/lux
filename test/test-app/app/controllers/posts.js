import { Controller } from 'LUMEN_LOCAL';

class PostsController extends Controller {
  params = [
    'user',
    'body',
    'title',
    'image',
    'isPublic'
  ];

  recent(request) {
    return this.index(request).order('createdAt', 'DESC');
  }

  featured() {
    return this.model.where({ isPublic: true }).limit(2);
  }

  topRated(request) {
    return this.index(request).where({ isPublic: true });
  }
}

export default PostsController;
