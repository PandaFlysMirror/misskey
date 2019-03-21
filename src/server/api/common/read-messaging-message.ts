import Message from '../../../models/messaging-message';
import { IMessagingMessage as IMessage } from '../../../models/messaging-message';
import { publishMainStream } from '../../../services/stream';
import { publishMessagingStream } from '../../../services/stream';
import { publishMessagingIndexStream } from '../../../services/stream';
import User from '../../../models/user';

/**
 * Mark messages as read
 */
export default (
	user: string | mongo.ObjectID,
	otherparty: string | mongo.ObjectID,
	message: string | string[] | IMessage | IMessage[] | mongo.ObjectID | mongo.ObjectID[]
) => new Promise<any>(async (resolve, reject) => {

	const userId = isObjectId(user)
		? user
		: new mongo.ObjectID(user);

	const otherpartyId = isObjectId(otherparty)
		? otherparty
		: new mongo.ObjectID(otherparty);

	const ids: mongo.ObjectID[] = Array.isArray(message)
		? isObjectId(message[0])
			? (message as mongo.ObjectID[])
			: typeof message[0] === 'string'
				? (message as string[]).map(m => new mongo.ObjectID(m))
				: (message as IMessage[]).map(m => m.id)
		: isObjectId(message)
			? [(message as mongo.ObjectID)]
			: typeof message === 'string'
				? [new mongo.ObjectID(message)]
				: [(message as IMessage).id];

	// Update documents
	await Message.update({
		id: { $in: ids },
		userId: otherpartyId,
		recipientId: userId,
		isRead: false
	}, {
			$set: {
				isRead: true
			}
		}, {
			multi: true
		});

	// Publish event
	publishMessagingStream(otherpartyId, userId, 'read', ids.map(id => id.toString()));
	publishMessagingIndexStream(userId, 'read', ids.map(id => id.toString()));

	// Calc count of my unread messages
	const count = await Message
		.count({
			recipientId: userId,
			isRead: false
		}, {
				limit: 1
			});

	if (count == 0) {
		// Update flag
		User.update({ _id: userId }, {
			$set: {
				hasUnreadMessagingMessage: false
			}
		});

		// 全ての(いままで未読だった)自分宛てのメッセージを(これで)読みましたよというイベントを発行
		publishMainStream(userId, 'readAllMessagingMessages');
	}
});
