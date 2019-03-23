import $ from 'cafy';
import { StringID, NumericalID } from '../../../../../misc/cafy-id';
import DriveFolder from '../../../../../models/entities/drive-folder';
import DriveFile, { validateFileName, pack } from '../../../../../models/entities/drive-file';
import { publishDriveStream } from '../../../../../services/stream';
import define from '../../../define';
import Note from '../../../../../models/entities/note';
import { ApiError } from '../../../error';

export const meta = {
	desc: {
		'ja-JP': '指定したドライブのファイルの情報を更新します。',
		'en-US': 'Update specified file of drive.'
	},

	tags: ['drive'],

	requireCredential: true,

	kind: 'drive-write',

	params: {
		fileId: {
			validator: $.type(StringID),
			desc: {
				'ja-JP': '対象のファイルID'
			}
		},

		folderId: {
			validator: $.optional.nullable.type(NumericalID),
			default: undefined as any,
			desc: {
				'ja-JP': 'フォルダID'
			}
		},

		name: {
			validator: $.optional.str.pipe(validateFileName),
			default: undefined as any,
			desc: {
				'ja-JP': 'ファイル名',
				'en-US': 'Name of the file'
			}
		},

		isSensitive: {
			validator: $.optional.bool,
			default: undefined as any,
			desc: {
				'ja-JP': 'このメディアが「閲覧注意」(NSFW)かどうか',
				'en-US': 'Whether this media is NSFW'
			}
		}
	},

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e7778c7e-3af9-49cd-9690-6dbc3e6c972d'
		},

		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '01a53b27-82fc-445b-a0c1-b558465a8ed2'
		},

		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: 'ea8fb7a5-af77-4a08-b608-c0218176cd73'
		},
	}
};

export default define(meta, async (ps, user) => {
	// Fetch file
	const file = await DriveFile
		.findOne({
			id: ps.fileId
		});

	if (file === null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	if (!user.isAdmin && !user.isModerator && !file.userId.equals(user.id)) {
		throw new ApiError(meta.errors.accessDenied);
	}

	if (ps.name) file.filename = ps.name;

	if (ps.isSensitive !== undefined) file.metadata.isSensitive = ps.isSensitive;

	if (ps.folderId !== undefined) {
		if (ps.folderId === null) {
			file.metadata.folderId = null;
		} else {
			// Fetch folder
			const folder = await DriveFolder
				.findOne({
					id: ps.folderId,
					userId: user.id
				});

			if (folder === null) {
				throw new ApiError(meta.errors.noSuchFolder);
			}

			file.metadata.folderId = folder.id;
		}
	}

	await DriveFile.update(file.id, {
		$set: {
			filename: file.filename,
			'metadata.folderId': file.metadata.folderId,
			'metadata.isSensitive': file.metadata.isSensitive
		}
	});

	// ドライブのファイルが非正規化されているドキュメントも更新
	Note.find({
		'_files.id': file.id
	}).then(notes => {
		for (const note of notes) {
			note._files[note._files.findIndex(f => f.id.equals(file.id))] = file;
			Note.update({ _id: note.id }, {
				$set: {
					_files: note._files
				}
			});
		}
	});

	const fileObj = await pack(file, { self: true });

	// Publish fileUpdated event
	publishDriveStream(user.id, 'fileUpdated', fileObj);

	return fileObj;
});
