import { publishMainStream } from '../../../../services/stream';
import define from '../../define';
import { MessagingMessages, Users } from '../../../../models';

export const meta = {
	desc: {
		'ja-JP': 'トークメッセージをすべて既読にします。',
		'en-US': 'Mark all talk messages as read.'
	},

	tags: ['account', 'messaging'],

	requireCredential: true,

	kind: 'account-write',

	params: {
	}
};

export default define(meta, async (ps, user) => {
	// Update documents
	await MessagingMessages.update({
		recipientId: user.id,
		isRead: false
	}, {
		isRead: true
	});

	publishMainStream(user.id, 'readAllMessagingMessages');
});
