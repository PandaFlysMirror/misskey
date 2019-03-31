import $ from 'cafy';
import define from '../../define';
import { Users } from '../../../../models';
import { User } from '../../../../models/entities/user';

export const meta = {
	desc: {
		'ja-JP': 'ユーザーを検索します。'
	},

	tags: ['users'],

	requireCredential: false,

	params: {
		query: {
			validator: $.str,
			desc: {
				'ja-JP': 'クエリ'
			}
		},

		offset: {
			validator: $.optional.num.min(0),
			default: 0,
			desc: {
				'ja-JP': 'オフセット'
			}
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10,
			desc: {
				'ja-JP': '取得する数'
			}
		},

		localOnly: {
			validator: $.optional.bool,
			default: false,
			desc: {
				'ja-JP': 'ローカルユーザーのみ検索対象にするか否か'
			}
		},

		detail: {
			validator: $.optional.bool,
			default: true,
			desc: {
				'ja-JP': '詳細なユーザー情報を含めるか否か'
			}
		},
	},

	res: {
		type: 'array',
		items: {
			type: 'User',
		}
	},
};

export default define(meta, async (ps, me) => {
	const isUsername = Users.validateUsername(ps.query.replace('@', ''), !ps.localOnly);

	let users: User[] = [];

	if (isUsername) {
		users = await Users.createQueryBuilder('user')
			.where('user.host IS NULL')
			.where('user.isSuspended = FALSE')
			.where('user.usernameLower like :username', { username: ps.query.replace('@', '').toLowerCase() + '%' })
			.take(ps.limit)
			.skip(ps.offset)
			.getMany();

		if (users.length < ps.limit && !ps.localOnly) {
			const otherUsers = await Users.createQueryBuilder('user')
				.where('user.host IS NOT NULL')
				.where('user.isSuspended = FALSE')
				.where('user.usernameLower like :username', { username: ps.query.replace('@', '').toLowerCase() + '%' })
				.take(ps.limit - users.length)
				.getMany();

			users = users.concat(otherUsers);
		}
	}

	return await Users.packMany(users, me, { detail: ps.detail });
});
