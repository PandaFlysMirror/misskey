import $ from 'cafy';
import ID, { transform } from '../../../../misc/cafy-id';
import Notification from '../../../../models/notification';
import { packMany } from '../../../../models/notification';
import { getFriendIds } from '../../common/get-friends';
import read from '../../common/read-notification';
import define from '../../define';
import { getHideUserIds } from '../../common/get-hide-users';

export const meta = {
	desc: {
		'ja-JP': '通知一覧を取得します。',
		'en-US': 'Get notifications.'
	},

	tags: ['account', 'notifications'],

	requireCredential: true,

	kind: 'account-read',

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		sinceId: {
			validator: $.optional.type(ID),
			transform: transform,
		},

		untilId: {
			validator: $.optional.type(ID),
			transform: transform,
		},

		following: {
			validator: $.optional.bool,
			default: false
		},

		markAsRead: {
			validator: $.optional.bool,
			default: true
		},

		includeTypes: {
			validator: $.optional.arr($.str.or(['follow', 'mention', 'reply', 'renote', 'quote', 'reaction', 'poll_vote', 'receiveFollowRequest'])),
			default: [] as string[]
		},

		excludeTypes: {
			validator: $.optional.arr($.str.or(['follow', 'mention', 'reply', 'renote', 'quote', 'reaction', 'poll_vote', 'receiveFollowRequest'])),
			default: [] as string[]
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'Notification',
		},
	},
};

export default define(meta, async (ps, user) => {
	const hideUserIds = await getHideUserIds(user);

	const query = {
		notifieeId: user.id,
		$and: [{
			notifierId: {
				$nin: hideUserIds
			}
		}]
	} as any;

	const sort = {
		_id: -1
	};

	if (ps.following) {
		// ID list of the user itself and other users who the user follows
		const followingIds = await getFriendIds(user.id);

		query.$and.push({
			notifierId: {
				$in: followingIds
			}
		});
	}

	if (ps.sinceId) {
		sort.id = 1;
		query.id = {
			$gt: ps.sinceId
		};
	} else if (ps.untilId) {
		query.id = {
			$lt: ps.untilId
		};
	}

	if (ps.includeTypes.length > 0) {
		query.type = {
			$in: ps.includeTypes
		};
	} else if (ps.excludeTypes.length > 0) {
		query.type = {
			$nin: ps.excludeTypes
		};
	}

	const notifications = await Notification
		.find(query, {
			limit: ps.limit,
			sort: sort
		});

	// Mark all as read
	if (notifications.length > 0 && ps.markAsRead) {
		read(user.id, notifications);
	}

	return await packMany(notifications);
});
