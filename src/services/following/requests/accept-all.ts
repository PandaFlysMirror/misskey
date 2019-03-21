import User, { IUser } from '../../../models/user';
import FollowRequest from '../../../models/follow-request';
import accept from './accept';

/**
 * 指定したユーザー宛てのフォローリクエストをすべて承認
 * @param user ユーザー
 */
export default async function(user: IUser) {
	const requests = await FollowRequest.find({
		followeeId: user._id
	});

	for (const request of requests) {
		const follower = await Users.findOne({ _id: request.followerId });
		accept(user, follower);
	}

	User.update({ _id: user._id }, {
		$set: {
			pendingReceivedFollowRequestsCount: 0
		}
	});
}
