import * as deepcopy from 'deepcopy';
import DriveFile from './drive-file';

const DriveFolder = db.get<IDriveFolder>('driveFolders');
DriveFolder.createIndex('userId');
export default DriveFolder;

export type IDriveFolder = {
	_id: mongo.ObjectID;
	createdAt: Date;
	name: string;
	userId: mongo.ObjectID;
	parentId: mongo.ObjectID;
};

export function isValidFolderName(name: string): boolean {
	return (
		(name.trim().length > 0) &&
		(name.length <= 200)
	);
}

/**
 * Pack a drive folder for API response
 */
export const pack = (
	folder: any,
	options?: {
		detail: boolean
	}
) => new Promise<any>(async (resolve, reject) => {
	const opts = Object.assign({
		detail: false
	}, options);

	let _folder: any;

	// Populate the folder if 'folder' is ID
	if (isObjectId(folder)) {
		_folder = await DriveFolder.findOne({ _id: folder });
	} else if (typeof folder === 'string') {
		_folder = await DriveFolder.findOne({ _id: new mongo.ObjectID(folder) });
	} else {
		_folder = deepcopy(folder);
	}

	// Rename _id to id
	_folder.id = _folder._id;
	delete _folder._id;

	if (opts.detail) {
		const childFoldersCount = await DriveFolder.count({
			parentId: _folder.id
		});

		const childFilesCount = await DriveFile.count({
			'metadata.folderId': _folder.id
		});

		_folder.foldersCount = childFoldersCount;
		_folder.filesCount = childFilesCount;
	}

	if (opts.detail && _folder.parentId) {
		// Populate parent folder
		_folder.parent = await pack(_folder.parentId, {
			detail: true
		});
	}

	resolve(_folder);
});
