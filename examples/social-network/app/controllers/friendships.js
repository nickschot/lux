import { Controller } from 'lumen-framework';

class FriendshipsController extends Controller {
  params = [
    'followee',
    'follower'
  ];
}

export default FriendshipsController;
