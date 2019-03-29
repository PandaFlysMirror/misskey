import { IRemoteUser } from '../../../../models/entities/user';
import { ILike } from '../../type';
import deleteReaction from '../../../../services/note/reaction/delete';
import { Notes } from '../../../../models';

/**
 * Process Undo.Like activity
 */
export default async (actor: IRemoteUser, activity: ILike): Promise<void> => {
	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;

	const noteId = id.split('/').pop();

	const note = await Notes.findOne(noteId);
	if (note == null) {
		throw 'note not found';
	}

	await deleteReaction(actor, note);
};
