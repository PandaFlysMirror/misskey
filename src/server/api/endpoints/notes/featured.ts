import $ from 'cafy';
import Note from '../../../../models/note';
import { packMany } from '../../../../models/note';
import define from '../../define';
import { getHideUserIds } from '../../common/get-hide-users';

export const meta = {
	desc: {
		'ja-JP': 'Featuredな投稿を取得します。',
		'en-US': 'Get featured notes.'
	},

	tags: ['notes'],

	requireCredential: false,

	params: {
		limit: {
			validator: $.optional.num.range(1, 30),
			default: 10,
			desc: {
				'ja-JP': '最大数'
			}
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'Note',
		},
	},
};

export default define(meta, async (ps, user) => {
	const day = 1000 * 60 * 60 * 24 * 3; // 3日前まで

	const hideUserIds = await getHideUserIds(user);

	const notes = await Note.find({
		createdAt: {
			$gt: new Date(Date.now() - day)
		},
		deletedAt: null,
		visibility: 'public',
		'_user.host': null,
		...(hideUserIds && hideUserIds.length > 0 ? { userId: { $nin: hideUserIds } } : {})
	}, {
		take: ps.limit,
		sort: {
			score: -1
		},
		hint: {
			score: -1
		}
	});

	return await packMany(notes, user);
});
