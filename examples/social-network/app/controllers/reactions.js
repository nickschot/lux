import { Controller } from 'lumen-framework';

class ReactionsController extends Controller {
  params = [
    'type',
    'user',
    'post',
    'comment'
  ];
}

export default ReactionsController;
