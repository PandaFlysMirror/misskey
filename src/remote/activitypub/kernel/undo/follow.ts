import User, { IRemoteUser } from '../../../../models/entities/user';
import config from '../../../../config';
import unfollow from '../../../../services/following/delete';
import cancelRequest from '../../../../services/following/requests/cancel';
import { IFollow } from '../../type';
import FollowRequest from '../../../../models/entities/follow-request';
import Following from '../../../../models/entities/following';

export default async (actor: IRemoteUser, activity: IFollow): Promise<void> => {
	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;

	if (!id.startsWith(config.url + '/')) {
		return null;
	}

	const followee = await Users.findOne({
		id: new mongo.ObjectID(id.split('/').pop())
	});

	if (followee === null) {
		throw new Error('followee not found');
	}

	if (followee.host != null) {
		throw new Error('フォロー解除しようとしているユーザーはローカルユーザーではありません');
	}

	const req = await FollowRequest.findOne({
		followerId: actor.id,
		followeeId: followee.id
	});

	const following = await Following.findOne({
		followerId: actor.id,
		followeeId: followee.id
	});

	if (req) {
		await cancelRequest(followee, actor);
	}

	if (following) {
		await unfollow(actor, followee);
	}
};
