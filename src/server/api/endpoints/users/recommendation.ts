import * as ms from 'ms';
import $ from 'cafy';
import define from '../../define';
import { Users, Followings } from '../../../../models';
import { generateMuteQueryForUsers } from '../../common/generate-mute-query';

export const meta = {
	desc: {
		'ja-JP': 'おすすめのユーザー一覧を取得します。'
	},

	tags: ['users'],

	requireCredential: true,

	kind: 'account-read',

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		offset: {
			validator: $.optional.num.min(0),
			default: 0
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'User',
		}
	},
};

export default define(meta, async (ps, me) => {
	const query = Users.createQueryBuilder('user')
		.where('user.isLocked = FALSE')
		.where('user.host IS NULL')
		.where('user.updatedAt >= :date', { date: new Date(Date.now() - ms('7days')) })
		.orderBy('user.followersCount', 'DESC');

	generateMuteQueryForUsers(query, me);

	const followingQuery = Followings.createQueryBuilder('following')
		.select('following.followeeId')
		.where('following.followerId = :followerId', { followerId: me.id });

	query
		.andWhere(`user.id NOT IN (${ followingQuery.getQuery() })`);

	query.setParameters(followingQuery.getParameters());

	const users = await query.take(ps.limit).skip(ps.offset).getMany();

	return await Promise.all(users.map(user => Users.pack(user, me, { detail: true })));
});
