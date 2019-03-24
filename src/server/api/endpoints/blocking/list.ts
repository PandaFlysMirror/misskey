import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import define from '../../define';
import { MoreThan, LessThan } from 'typeorm';
import { Blockings } from '../../../../models';

export const meta = {
	desc: {
		'ja-JP': 'ブロックしているユーザー一覧を取得します。',
		'en-US': 'Get blocking users.'
	},

	tags: ['blocking', 'account'],

	requireCredential: true,

	kind: 'following-read',

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 30
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
			type: 'Blocking',
		}
	},
};

export default define(meta, async (ps, me) => {
	const query = {
		blockerId: me.id
	} as any;

	const sort = {
		id: -1
	};

	if (ps.sinceId) {
		sort.id = 1;
		query.id = MoreThan(ps.sinceId);
	} else if (ps.untilId) {
		query.id = LessThan(ps.untilId);
	}

	const blockings = await Blockings.find({
		where: query,
		take: ps.limit,
		order: sort
	});

	return await Blockings.packMany(blockings, me);
});
