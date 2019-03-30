import $ from 'cafy';
import define from '../../define';
import { generateMuteQuery } from '../../common/generate-mute-query';
import { Notes } from '../../../../models';

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

	const query = Notes.createQueryBuilder('note')
		.andWhere(`note.createdAt > :date`, { date: new Date(Date.now() - day) })
		.andWhere(`note.visibility = 'public'`)
		.leftJoinAndSelect('note.user', 'user');

	if (user) generateMuteQuery(query, user);

	const notes = await query.orderBy('note.score', 'DESC').take(ps.limit).getMany();

	return await Notes.packMany(notes, user);
});
