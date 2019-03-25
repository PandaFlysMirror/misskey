import $ from 'cafy';
import { ID } from '../../../../../misc/cafy-id';
import define from '../../../define';
import { ApiError } from '../../../error';
import { DriveFiles } from '../../../../../models';

export const meta = {
	stability: 'stable',

	desc: {
		'ja-JP': '指定したドライブのファイルが添付されている投稿一覧を取得します。',
		'en-US': 'Get the notes that specified file of drive attached.'
	},

	tags: ['drive', 'notes'],

	requireCredential: true,

	kind: 'drive-read',

	params: {
		fileId: {
			validator: $.type(ID),
			desc: {
				'ja-JP': '対象のファイルID',
				'en-US': 'Target file ID'
			}
		}
	},

	res: {
		type: 'array',
		items: {
			type: 'Note',
		},
	},

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'c118ece3-2e4b-4296-99d1-51756e32d232',
		}
	}
};

export default define(meta, async (ps, user) => {
	// Fetch file
	const file = await DriveFiles.findOne({
		id: ps.fileId,
		userId: user.id,
	});

	if (file === null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	/* v11 TODO
	return await packMany(file.metadata.attachedNoteIds || [], user, {
		detail: true
	});*/
});
