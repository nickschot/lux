import { Controller } from 'lumen-framework';

class MembersCommentsController extends Controller {
  params = [
    'post',
    'user',
    'message'
  ];
}

export default MembersCommentsController;
