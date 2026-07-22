import { Controller } from 'LUMEN_LOCAL';

class CommentsController extends Controller {
  params = [
    'post',
    'user',
    'edited',
    'message'
  ];
}

export default CommentsController;
