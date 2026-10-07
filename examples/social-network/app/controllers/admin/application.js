import ApplicationController from '../application';

class AdminApplicationController extends ApplicationController {
  // Admins see everything.
  static visibility = {};
}

export default AdminApplicationController;
