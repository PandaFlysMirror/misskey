import Note from '../../../models/entities/note';
import { IRemoteUser } from '../../../models/entities/user';
import { ILike } from '../type';
import create from '../../../services/note/reaction/create';

export default async (actor: IRemoteUser, activity: ILike) => {
	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;

	// Transform:
	// https://misskey.ex/notes/xxxx to
	// xxxx
	const noteId = id.split('/').pop();

	const note = await Note.findOne({ _id: noteId });
	if (note === null) {
		throw new Error();
	}

	await create(actor, note, activity._misskey_reaction);
};
