import { Controller } from 'LUMEN_LOCAL';

class ApplicationController extends Controller {
  // Private posts are hidden from every request outside `admin` — from
  // listings, lookups, relationships and `include` alike.
  static visibility = {
    posts: query => query.isPublic()
  };

  webhooks(request) {
    return { received: request.body ?? null };
  }
}

export default ApplicationController;
