import { Controller } from 'LUMEN_LOCAL';

class ReactionsController extends Controller {
  params = [
    'type',
    'user',
    'post',
    'comment'
  ];
}

export default ReactionsController;
