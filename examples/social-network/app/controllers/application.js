import { Controller } from 'lumen-framework';

class ApplicationController extends Controller {
  // Private posts are hidden from every request outside `admin` — from
  // listings, lookups, relationships and `include` alike.
  static visibility = {
    posts: query => query.isPublic()
  };
}

export default ApplicationController;
