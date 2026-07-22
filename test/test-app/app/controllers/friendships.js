import { Controller } from 'LUMEN_LOCAL';

class FriendshipsController extends Controller {
  params = [
    'followee',
    'follower'
  ];
}

export default FriendshipsController;
