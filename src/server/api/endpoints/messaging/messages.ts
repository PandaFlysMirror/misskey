import $ from 'cafy';
import { StringID, NumericalID } from '../../../../misc/cafy-id';
import Message from '../../../../models/entities/messaging-message';
import { pack } from '../../../../models/entities/messaging-message';
import read from '../../common/read-messaging-message';
import define from '../../define';
import { ApiError } from '../../error';
import { getUser } from '../../common/getters';

export const meta = {
	desc: {
		'ja-JP': '指定したユーザーとのMessagingのメッセージ一覧を取得します。',
		'en-US': 'Get messages of messaging.'
	},

	tags: ['messaging'],

	requireCredential: true,

	kind: 'messaging-read',

	params: {
		userId: {
			validator: $.type(StringID),
				'ja-JP': '対象のユーザーのID',
				'en-US': 'Target user ID'
			}
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		sinceId: {
			validator: $.optional.type(NumericalID),
		},

		untilId: {
			validator: $.optional.type(NumericalID),,

		markAsRead: {
			validator: $.optional.bool,
			default: true
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'MessagingMessage',
		},
	},

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '11795c64-40ea-4198-b06e-3c873ed9039d'
		},
	}
};

export default define(meta, async (ps, user) => {
	// Fetch recipient
	const recipient = await getUser(ps.userId).catch(e => {
		if (e.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	const query = {
		$or: [{
			userId: user.id,
			recipientId: recipient.id
		}, {
			userId: recipient.id,
			recipientId: user.id
		}]
	} as any;

	const sort = {
		id: -1
	};

	if (ps.sinceId) {
		sort.id = 1;
		query.id = MoreThan(ps.sinceId);
	} else if (ps.untilId) {
		query.id = LessThan(ps.untilId);
	}

	const messages = await Message
		.find(query, {
			take: ps.limit,
			sort: sort
		});

	// Mark all as read
	if (ps.markAsRead) {
		read(user.id, recipient.id, messages);
	}

	return await Promise.all(messages.map(message => pack(message, user, {
		populateRecipient: false
	})));
});
