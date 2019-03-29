import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import define from '../../define';
import { DriveFolders } from '../../../../models';
import { generatePaginationQuery } from '../../common/generate-pagination-query';

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
	const query = generatePaginationQuery(DriveFolders.createQueryBuilder('folder'), ps.sinceId, ps.untilId)
		.andWhere('folder.userId = :userId', { userId: user.id });

	if (ps.folderId) {
		query.andWhere('folder.parentId = :parentId', { parentId: ps.folderId });
	} else {
		query.andWhere('folder.parentId IS NULL');
	}

	const folders = await query.take(ps.limit).getMany();

	return await Promise.all(folders.map(folder => DriveFolders.pack(folder)));
});
