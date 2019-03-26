import * as Router from 'koa-router';
import config from '../../config';
import { renderActivity } from '../../remote/activitypub/renderer';
import renderOrderedCollection from '../../remote/activitypub/renderer/ordered-collection';
import { setResponseType } from '../activitypub';
import renderNote from '../../remote/activitypub/renderer/note';
import { Users, Notes, UserNotePinings } from '../../models';

export default async (ctx: Router.IRouterContext) => {
	const userId = ctx.params.user;

	// Verify user
	const user = await Users.findOne({
		id: userId,
		host: null
	});

	if (user == null) {
		ctx.status = 404;
		return;
	}

	const pinings = await UserNotePinings.find({ userId: user.id });

	const pinnedNotes = await Promise.all(pinings.map(pining => Notes.findOne(pining.noteId)));

	const renderedNotes = await Promise.all(pinnedNotes.map(note => renderNote(note)));

	const rendered = renderOrderedCollection(
		`${config.url}/users/${userId}/collections/featured`,
		renderedNotes.length, null, null, renderedNotes
	);

	ctx.body = renderActivity(rendered);
	ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
	setResponseType(ctx);
};
