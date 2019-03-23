import $ from 'cafy';
import { StringID, NumericalID } from '../../../../../misc/cafy-id';
import DriveFolder, { pack } from '../../../../../models/entities/drive-folder';
import define from '../../../define';

export const meta = {
	tags: ['drive'],

	requireCredential: true,

	kind: 'drive-read',

	params: {
		name: {
			validator: $.str
		},

		parentId: {
			validator: $.optional.nullable.type(NumericalID),
			default: null as any,
			desc: {
				'ja-JP': 'フォルダID'
			}
		},
	},

	res: {
		type: 'array',
		items: {
			type: 'DriveFolder',
		},
	},
};

export default define(meta, async (ps, user) => {
	const folders = await DriveFolder
		.find({
			name: ps.name,
			userId: user.id,
			parentId: ps.parentId
		});

	return await Promise.all(folders.map(folder => pack(folder)));
});
