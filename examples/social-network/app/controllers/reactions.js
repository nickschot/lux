import { Controller } from 'lumen-framework';

class ReactionsController extends Controller {
  params = [
    'kind',
    'user',
    'post',
    'comment'
  ];
}

export default ReactionsController;
