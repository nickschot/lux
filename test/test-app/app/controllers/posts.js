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

  // A plain route's body is any JSON, as sent.
  // The body as received, and the params: which on a plain route hold only
  // the query string.
  echo(request) {
    return { received: request.body ?? null, params: request.params };
  }

  topRated(request) {
    return this.index(request).where({ isPublic: true });
  }
}

export default PostsController;
