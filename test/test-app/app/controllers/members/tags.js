import { Controller } from 'LUMEN_LOCAL';

// Listing tags requires a parameter of the controller's own (`query`): a read
// `auditVisibility()` can only request with its `query` option.
class MembersTagsController extends Controller {
  query = [
    'fromDate'
  ];

  index(request, response) {
    if (!request.params.fromDate) {
      return 400;
    }

    return super.index(request, response);
  }
}

export default MembersTagsController;
