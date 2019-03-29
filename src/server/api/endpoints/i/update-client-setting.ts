import $ from 'cafy';
import { publishMainStream } from '../../../../services/stream';
import define from '../../define';
import { Users } from '../../../../models';

export const meta = {
	requireCredential: true,

	secure: true,

	params: {
		name: {
			validator: $.str.match(/^[a-zA-Z]+$/)
		},

		value: {
			validator: $.nullable.any
		}
	}
};

export default define(meta, async (ps, user) => {
	await Users.createQueryBuilder().update()
		.set({
			clientData: {
				[ps.name]: ps.value
			},
		})
		.where('id = :id', { id: user.id })
		.execute();

	// Publish event
	publishMainStream(user.id, 'clientSettingUpdated', {
		key: ps.name,
		value: ps.value
	});
});
