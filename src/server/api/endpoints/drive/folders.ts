import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import DriveFolder, { pack } from '../../../../models/entities/drive-folder';
import define from '../../define';

export const meta = {
	desc: {
		'ja-JP': 'ドライブのフォルダ一覧を取得します。',
		'en-US': 'Get folders of drive.'
	},

	tags: ['drive'],

	requireCredential: true,

	kind: 'drive-read',

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		sinceId: {
			validator: $.optional.type(ID),
		},

		untilId: {
			validator: $.optional.type(ID),
		},

		folderId: {
			validator: $.optional.nullable.type(ID),
			default: null as any,
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'DriveFolder',
		},
	},
};

export default define(meta, async (ps, user) => {
	const sort = {
		id: -1
	};
	const query = {
		userId: user.id,
		parentId: ps.folderId
	} as any;
	if (ps.sinceId) {
		sort.id = 1;
		query.id = MoreThan(ps.sinceId);
	} else if (ps.untilId) {
		query.id = LessThan(ps.untilId);
	}

	const folders = await DriveFolder
		.find(query, {
			take: ps.limit,
			order: sort
		});

	return await Promise.all(folders.map(folder => pack(folder)));
});
