import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import define from '../../define';
import { getNote } from '../../common/getters';
import { ApiError } from '../../error';
import { NoteReactions } from '../../../../models';

export const meta = {
	desc: {
		'ja-JP': '指定した投稿のリアクション一覧を取得します。',
		'en-US': 'Show reactions of a note.'
	},

	tags: ['notes', 'reactions'],

	requireCredential: false,

	params: {
		noteId: {
			validator: $.type(ID),
			desc: {
				'ja-JP': '対象の投稿のID',
				'en-US': 'The ID of the target note'
			}
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		offset: {
			validator: $.optional.num,
			default: 0
		},

		sinceId: {
			validator: $.optional.type(ID),
		},

		untilId: {
			validator: $.optional.type(ID),
		},
	},

	res: {
		type: 'array',
		items: {
			type: 'Reaction'
		}
	},

	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '263fff3d-d0e1-4af4-bea7-8408059b451a'
		}
	}
};

export default define(meta, async (ps, user) => {
	const note = await getNote(ps.noteId).catch(e => {
		if (e.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
		throw e;
	});

	const query = {
		noteId: note.id
	};

	const reactions = await NoteReactions.find({
		where: query,
		take: ps.limit,
		skip: ps.offset,
		order: {
			id: -1
		}
	});

	return await Promise.all(reactions.map(reaction => NoteReactions.pack(reaction, user)));
});
