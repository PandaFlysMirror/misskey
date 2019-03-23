import $ from 'cafy';
import { StringID, NumericalID } from '../../../../misc/cafy-id';
import define from '../../define';
import Favorite from '../../../../models/note-favorite';
import NoteWatching from '../../../../models/note-watching';

export const meta = {
	stability: 'stable',

	desc: {
		'ja-JP': '指定した投稿の状態を取得します。',
		'en-US': 'Get state of a note.'
	},

	tags: ['notes'],

	requireCredential: true,

	params: {
		noteId: {
			validator: $.type(StringID),
			desc: {
				'ja-JP': '対象の投稿のID',
				'en-US': 'Target note ID.'
			}
		}
	}
};

export default define(meta, async (ps, user) => {
	const [favorite, watching] = await Promise.all([
		Favorite.count({
			userId: user.id,
			noteId: ps.noteId
		}, {
			limit: 1
		}),
		NoteWatching.count({
			userId: user.id,
			noteId: ps.noteId
		}, {
			limit: 1
		})
	]);

	return {
		isFavorited: favorite !== 0,
		isWatching: watching !== 0
	};
});
