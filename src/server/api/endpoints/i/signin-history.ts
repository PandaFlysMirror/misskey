import $ from 'cafy';
import ID, { transform } from '../../../../misc/cafy-id';
import Signin, { pack } from '../../../../models/signin';
import define from '../../define';

export const meta = {
	requireCredential: true,

	secure: true,

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		sinceId: {
			validator: $.optional.type(ID),
			transform: transform,
		},

		untilId: {
			validator: $.optional.type(ID),
			transform: transform,
		}
	}
};

export default define(meta, async (ps, user) => {
	const query = {
		userId: user.id
	} as any;

	const sort = {
		id: -1
	};

	if (ps.sinceId) {
		sort.id = 1;
		query.id = {
			$gt: ps.sinceId
		};
	} else if (ps.untilId) {
		query.id = {
			$lt: ps.untilId
		};
	}

	const history = await Signin
		.find(query, {
			limit: ps.limit,
			sort: sort
		});

	return await Promise.all(history.map(record => pack(record)));
});
