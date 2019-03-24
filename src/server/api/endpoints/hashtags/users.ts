import $ from 'cafy';
import User, { pack } from '../../../../models/entities/user';
import define from '../../define';

export const meta = {
	requireCredential: false,

	tags: ['hashtags', 'users'],

	params: {
		tag: {
			validator: $.str,
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		sort: {
			validator: $.str.or([
				'+follower',
				'-follower',
				'+createdAt',
				'-createdAt',
				'+updatedAt',
				'-updatedAt',
			]),
		},

		state: {
			validator: $.optional.str.or([
				'all',
				'alive'
			]),
			default: 'all'
		},

		origin: {
			validator: $.optional.str.or([
				'combined',
				'local',
				'remote',
			]),
			default: 'local'
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'User'
		}
	},
};

const sort: any = {
	'+follower': { followersCount: -1 },
	'-follower': { followersCount: 1 },
	'+createdAt': { createdAt: -1 },
	'-createdAt': { createdAt: 1 },
	'+updatedAt': { updatedAt: -1 },
	'-updatedAt': { updatedAt: 1 },
};

export default define(meta, async (ps, me) => {
	const q = {
		tags: ps.tag,
		$and: []
	} as any;

	// state
	q.$and.push(
		ps.state == 'alive' ? { updatedAt: { $gt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 5)) } } :
		{}
	);

	// origin
	q.$and.push(
		ps.origin == 'local' ? { host: null } :
		ps.origin == 'remote' ? { host: { $ne: null } } :
		{}
	);

	const users = await User
		.find(q, {
			take: ps.limit,
			order: sort[ps.sort],
		});

	return await Promise.all(users.map(user => pack(user, me, { detail: true })));
});
