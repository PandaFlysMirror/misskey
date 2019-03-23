import { publishMainStream } from '../stream';
import User from '../../models/entities/user';
import NoteUnread from '../../models/entities/note-unread';

/**
 * Mark a note as read
 */
export default (
	user: string | mongo.ObjectID,
	note: string | mongo.ObjectID
) => new Promise<any>(async (resolve, reject) => {

	const userId: mongo.ObjectID = isObjectId(user)
		? user as mongo.ObjectID
		: new mongo.ObjectID(user);

	const noteId: mongo.ObjectID = isObjectId(note)
		? note as mongo.ObjectID
		: new mongo.ObjectID(note);

	// Remove document
	const res = await NoteUnread.remove({
		userId: userId,
		noteId: noteId
	});

	if (res.deletedCount == 0) {
		return;
	}

	const count1 = await NoteUnread
		.count({
			userId: userId,
			isSpecified: false
		}, {
			limit: 1
		});

	const count2 = await NoteUnread
		.count({
			userId: userId,
			isSpecified: true
		}, {
			limit: 1
		});

	if (count1 == 0 || count2 == 0) {
		User.update({ _id: userId }, {
			$set: {
				hasUnreadMentions: count1 != 0 || count2 != 0,
				hasUnreadSpecifiedNotes: count2 != 0
			}
		});
	}

	if (count1 == 0) {
		// 全て既読になったイベントを発行
		publishMainStream(userId, 'readAllUnreadMentions');
	}

	if (count2 == 0) {
		// 全て既読になったイベントを発行
		publishMainStream(userId, 'readAllUnreadSpecifiedNotes');
	}
});
