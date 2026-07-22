import { Controller } from 'lumen-framework';

class CommentsController extends Controller {
  params = [
    'post',
    'user',
    'edited',
    'message'
  ];
}

export default CommentsController;
