import * as Bull from 'bull';

import { queueLogger } from '../../logger';
import Note from '../../../models/note';
import deleteNote from '../../../services/note/delete';
import User from '../../../models/user';

const logger = queueLogger.createSubLogger('delete-notes');

export async function deleteNotes(job: Bull.Job, done: any): Promise<void> {
	logger.info(`Deleting notes of ${job.data.user._id} ...`);

	const user = await Users.findOne({
		_id: new mongo.ObjectID(job.data.user._id.toString())
	});

	let deletedCount = 0;
	let ended = false;
	let cursor: any = null;

	while (!ended) {
		const notes = await Note.find({
			userId: user._id,
			...(cursor ? { _id: { $gt: cursor } } : {})
		}, {
			limit: 100,
			sort: {
				_id: 1
			}
		});

		if (notes.length === 0) {
			ended = true;
			job.progress(100);
			break;
		}

		cursor = notes[notes.length - 1]._id;

		for (const note of notes) {
			await deleteNote(user, note, true);
			deletedCount++;
		}

		const total = await Note.count({
			userId: user._id,
		});

		job.progress(deletedCount / total);
	}

	logger.succ(`All notes (${deletedCount}) of ${user._id} has been deleted.`);
	done();
}
