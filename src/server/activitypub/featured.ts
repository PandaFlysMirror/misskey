import { ObjectID } from 'mongodb';
import * as Router from 'koa-router';
import config from '../../config';
import User from '../../models/user';
import { renderActivity } from '../../remote/activitypub/renderer';
import renderOrderedCollection from '../../remote/activitypub/renderer/ordered-collection';
import { setResponseType } from '../activitypub';
import Note from '../../models/note';
import renderNote from '../../remote/activitypub/renderer/note';

export default async (ctx: Router.IRouterContext) => {
	if (!ObjectID.isValid(ctx.params.user)) {
		ctx.status = 404;
		return;
	}

	const userId = new ObjectID(ctx.params.user);

	// Verify user
	const user = await Users.findOne({
		_id: userId,
		host: null
	});

	if (user === null) {
		ctx.status = 404;
		return;
	}

	const pinnedNoteIds = user.pinnedNoteIds || [];

	const pinnedNotes = await Promise.all(pinnedNoteIds.filter(ObjectID.isValid).map(id => Note.findOne({ _id: id })));

	const renderedNotes = await Promise.all(pinnedNotes.map(note => renderNote(note)));

	const rendered = renderOrderedCollection(
		`${config.url}/users/${userId}/collections/featured`,
		renderedNotes.length, null, null, renderedNotes
	);

	ctx.body = renderActivity(rendered);
	ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
	setResponseType(ctx);
};
