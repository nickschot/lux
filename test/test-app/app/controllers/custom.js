import { Controller } from 'LUMEN_LOCAL';

class CustomController extends Controller {
  query = [
    'userId'
  ];

  index() {
    return 204;
  };
}

export default CustomController;
