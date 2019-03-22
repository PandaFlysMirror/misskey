import User, { User, isRemoteUser, ILocalUser, pack as packUser } from '../../../models/user';
import FollowRequest from '../../../models/follow-request';
import { renderActivity } from '../../../remote/activitypub/renderer';
import renderFollow from '../../../remote/activitypub/renderer/follow';
import renderReject from '../../../remote/activitypub/renderer/reject';
import { deliver } from '../../../queue';
import { publishMainStream } from '../../stream';

export default async function(followee: User, follower: User) {
	if (isRemoteUser(follower)) {
		const request = await FollowRequest.findOne({
			followeeId: followee.id,
			followerId: follower.id
		});

		const content = renderActivity(renderReject(renderFollow(follower, followee, request.requestId), followee as ILocalUser));
		deliver(followee as ILocalUser, content, follower.inbox);
	}

	await FollowRequest.remove({
		followeeId: followee.id,
		followerId: follower.id
	});

	User.update({ _id: followee.id }, {
		$inc: {
			pendingReceivedFollowRequestsCount: -1
		}
	});

	packUser(followee, follower, {
		detail: true
	}).then(packed => publishMainStream(follower.id, 'unfollow', packed));
}
