import { Buffer } from 'buffer';
import * as fs from 'fs';

import * as crypto from 'crypto';
import * as Minio from 'minio';
import * as uuid from 'uuid';
import * as sharp from 'sharp';

import { publishMainStream, publishDriveStream } from '../stream';
import delFile from './delete-file';
import config from '../../config';
import fetchMeta from '../../misc/fetch-meta';
import { GenerateVideoThumbnail } from './generate-video-thumbnail';
import { driveLogger } from './logger';
import { IImage, ConvertToJpeg, ConvertToWebp, ConvertToPng } from './image-processor';
import { contentDisposition } from '../../misc/content-disposition';
import { detectMine } from '../../misc/detect-mine';
import { DriveFiles, DriveFolders, Users, Instances } from '../../models';
import { InternalStorage } from './internal-storage';
import { DriveFile } from '../../models/entities/drive-file';
import { IRemoteUser, User } from '../../models/entities/user';
import { driveChart, perUserDriveChart, instanceChart } from '../chart';
import { genId } from '../../misc/gen-id';

const logger = driveLogger.createSubLogger('register', 'yellow');

/***
 * Save file
 * @param path Path for original
 * @param name Name for original
 * @param type Content-Type for original
 * @param hash Hash for original
 * @param size Size for original
 */
async function save(file: DriveFile, path: string, name: string, type: string, hash: string, size: number): Promise<DriveFile> {
	// thunbnail, webpublic を必要なら生成
	const alts = await generateAlts(path, type, !file.uri);

	if (config.drive && config.drive.storage == 'minio') {
		//#region ObjectStorage params
		let [ext] = (name.match(/\.([a-zA-Z0-9_-]+)$/) || ['']);

		if (ext === '') {
			if (type === 'image/jpeg') ext = '.jpg';
			if (type === 'image/png') ext = '.png';
			if (type === 'image/webp') ext = '.webp';
		}

		const baseUrl = config.drive.baseUrl
			|| `${ config.drive.config.useSSL ? 'https' : 'http' }://${ config.drive.config.endPoint }${ config.drive.config.port ? `:${config.drive.config.port}` : '' }/${ config.drive.bucket }`;

		// for original
		const key = `${config.drive.prefix}/${uuid.v4()}${ext}`;
		const url = `${ baseUrl }/${ key }`;

		// for alts
		let webpublicKey: string = null;
		let webpublicUrl: string = null;
		let thumbnailKey: string = null;
		let thumbnailUrl: string = null;
		//#endregion

		//#region Uploads
		logger.info(`uploading original: ${key}`);
		const uploads = [
			upload(key, fs.createReadStream(path), type, name)
		];

		if (alts.webpublic) {
			webpublicKey = `${config.drive.prefix}/${uuid.v4()}.${alts.webpublic.ext}`;
			webpublicUrl = `${ baseUrl }/${ webpublicKey }`;

			logger.info(`uploading webpublic: ${webpublicKey}`);
			uploads.push(upload(webpublicKey, alts.webpublic.data, alts.webpublic.type, name));
		}

		if (alts.thumbnail) {
			thumbnailKey = `${config.drive.prefix}/${uuid.v4()}.${alts.thumbnail.ext}`;
			thumbnailUrl = `${ baseUrl }/${ thumbnailKey }`;

			logger.info(`uploading thumbnail: ${thumbnailKey}`);
			uploads.push(upload(thumbnailKey, alts.thumbnail.data, alts.thumbnail.type));
		}

		await Promise.all(uploads);
		//#endregion

		file.url = url;
		file.thumbnailUrl = thumbnailUrl;
		file.webpublicUrl = webpublicUrl;
		file.accessKey = key;
		file.thumbnailAccessKey = thumbnailKey;
		file.webpublicAccessKey = webpublicKey;
		file.name = name;
		file.type = type;
		file.md5 = hash;
		file.size = size;

		return await DriveFiles.save(file);
	} else { // use internal storage
		const accessKey = uuid.v4();
		const thumbnailAccessKey = uuid.v4();
		const webpublicAccessKey = uuid.v4();

		const url = InternalStorage.saveFromPath(accessKey, path);

		let thumbnailUrl: string;
		let webpublicUrl: string;

		if (alts.thumbnail) {
			thumbnailUrl = InternalStorage.saveFromBuffer(thumbnailAccessKey, alts.thumbnail.data);
			logger.info(`thumbnail stored: ${thumbnailAccessKey}`);
		}

		if (alts.webpublic) {
			webpublicUrl = InternalStorage.saveFromBuffer(webpublicAccessKey, alts.webpublic.data);
			logger.info(`web stored: ${webpublicAccessKey}`);
		}

		file.storedInternal = true;
		file.url = url;
		file.thumbnailUrl = thumbnailUrl;
		file.webpublicUrl = webpublicUrl;
		file.accessKey = accessKey;
		file.thumbnailAccessKey = thumbnailAccessKey;
		file.webpublicAccessKey = webpublicAccessKey;
		file.name = name;
		file.type = type;
		file.md5 = hash;
		file.size = size;

		return await DriveFiles.save(file);
	}
}

/**
 * Generate webpublic, thumbnail, etc
 * @param path Path for original
 * @param type Content-Type for original
 * @param generateWeb Generate webpublic or not
 */
export async function generateAlts(path: string, type: string, generateWeb: boolean) {
	// #region webpublic
	let webpublic: IImage;

	if (generateWeb) {
		logger.info(`creating web image`);

		if (['image/jpeg'].includes(type)) {
			webpublic = await ConvertToJpeg(path, 2048, 2048);
		} else if (['image/webp'].includes(type)) {
			webpublic = await ConvertToWebp(path, 2048, 2048);
		} else if (['image/png'].includes(type)) {
			webpublic = await ConvertToPng(path, 2048, 2048);
		} else {
			logger.info(`web image not created (not an image)`);
		}
	} else {
		logger.info(`web image not created (from remote)`);
	}
	// #endregion webpublic

	// #region thumbnail
	let thumbnail: IImage;

	if (['image/jpeg', 'image/webp'].includes(type)) {
		thumbnail = await ConvertToJpeg(path, 498, 280);
	} else if (['image/png'].includes(type)) {
		thumbnail = await ConvertToPng(path, 498, 280);
	} else if (type.startsWith('video/')) {
		try {
			thumbnail = await GenerateVideoThumbnail(path);
		} catch (e) {
			logger.error(`GenerateVideoThumbnail failed: ${e}`);
		}
	}
	// #endregion thumbnail

	return {
		webpublic,
		thumbnail,
	};
}

/**
 * Upload to ObjectStorage
 */
async function upload(key: string, stream: fs.ReadStream | Buffer, type: string, filename?: string) {
	const minio = new Minio.Client(config.drive.config);

	const metadata = {
		'Content-Type': type,
		'Cache-Control': 'max-age=31536000, immutable'
	} as Minio.ItemBucketMetadata;

	if (filename) metadata['Content-Disposition'] = contentDisposition('inline', filename);

	await minio.putObject(config.drive.bucket, key, stream, null, metadata);
}

async function deleteOldFile(user: IRemoteUser) {
	const oldFile = await DriveFiles.createQueryBuilder()
		.select('file')
		.where('file.id IN (:...ids)', { ids: [user.avatarId, user.bannerId] })
		.andWhere('file.userId = :userId', { userId: user.id })
		.orderBy('file.id', 'DESC')
		.getOne();

	if (oldFile) {
		delFile(oldFile, true);
	}
}

/**
 * Add file to drive
 *
 * @param user User who wish to add file
 * @param path File path
 * @param name Name
 * @param comment Comment
 * @param folderId Folder ID
 * @param force If set to true, forcibly upload the file even if there is a file with the same hash.
 * @param isLink Do not save file to local
 * @param url URL of source (URLからアップロードされた場合(ローカル/リモート)の元URL)
 * @param uri URL of source (リモートインスタンスのURLからアップロードされた場合の元URL)
 * @param sensitive Mark file as sensitive
 * @return Created drive file
 */
export default async function(
	user: User,
	path: string,
	name: string = null,
	comment: string = null,
	folderId: any = null,
	force: boolean = false,
	isLink: boolean = false,
	url: string = null,
	uri: string = null,
	sensitive: boolean = null
): Promise<DriveFile> {
	// Calc md5 hash
	const calcHash = new Promise<string>((res, rej) => {
		const readable = fs.createReadStream(path);
		const hash = crypto.createHash('md5');
		const chunks: Buffer[] = [];
		readable
			.on('error', rej)
			.pipe(hash)
			.on('error', rej)
			.on('data', chunk => chunks.push(chunk))
			.on('end', () => {
				const buffer = Buffer.concat(chunks);
				res(buffer.toString('hex'));
			});
	});

	// Get file size
	const getFileSize = new Promise<number>((res, rej) => {
		fs.stat(path, (err, stats) => {
			if (err) return rej(err);
			res(stats.size);
		});
	});

	const [hash, [mime, ext], size] = await Promise.all([calcHash, detectMine(path), getFileSize]);

	logger.info(`hash: ${hash}, mime: ${mime}, ext: ${ext}, size: ${size}`);

	// detect name
	const detectedName = name || (ext ? `untitled.${ext}` : 'untitled');

	if (!force) {
		// Check if there is a file with the same hash
		const much = await DriveFiles.findOne({
			md5: hash,
			userId: user.id,
		});

		if (much) {
			logger.info(`file with same hash is found: ${much.id}`);
			return much;
		}
	}

	//#region Check drive usage
	if (!isLink) {
		const usage = await DriveFiles.clacDriveUsageOf(user);

		const instance = await fetchMeta();
		const driveCapacity = 1024 * 1024 * (Users.isLocalUser(user) ? instance.localDriveCapacityMb : instance.remoteDriveCapacityMb);

		logger.debug(`drive usage is ${usage} (max: ${driveCapacity})`);

		// If usage limit exceeded
		if (usage + size > driveCapacity) {
			if (Users.isLocalUser(user)) {
				throw 'no-free-space';
			} else {
				// (アバターまたはバナーを含まず)最も古いファイルを削除する
				deleteOldFile(user);
			}
		}
	}
	//#endregion

	const fetchFolder = async () => {
		if (!folderId) {
			return null;
		}

		const driveFolder = await DriveFolders.findOne({
			id: folderId,
			userId: user.id
		});

		if (driveFolder == null) throw 'folder-not-found';

		return driveFolder;
	};

	const properties: {[key: string]: any} = {};

	let propPromises: Promise<void>[] = [];

	const isImage = ['image/jpeg', 'image/gif', 'image/png', 'image/webp'].includes(mime);

	if (isImage) {
		const img = sharp(path);

		// Calc width and height
		const calcWh = async () => {
			logger.debug('calculating image width and height...');

			// Calculate width and height
			const meta = await img.metadata();

			logger.debug(`image width and height is calculated: ${meta.width}, ${meta.height}`);

			properties['width'] = meta.width;
			properties['height'] = meta.height;
		};

		// Calc average color
		const calcAvg = async () => {
			logger.debug('calculating average color...');

			try {
				const info = await (img as any).stats();

				const r = Math.round(info.channels[0].mean);
				const g = Math.round(info.channels[1].mean);
				const b = Math.round(info.channels[2].mean);

				logger.debug(`average color is calculated: ${r}, ${g}, ${b}`);

				const value = info.isOpaque ? [r, g, b] : [r, g, b, 255];

				properties['avgColor'] = value;
			} catch (e) { }
		};

		propPromises = [calcWh(), calcAvg()];
	}

	const [folder] = await Promise.all([fetchFolder(), Promise.all(propPromises)]);

	let file = new DriveFile();
	file.id = genId();
	file.createdAt = new Date();
	file.userId = user.id;
	file.userHost = user.host;
	file.folderId = folder !== null ? folder.id : null;
	file.comment = comment;
	file.properties = properties;
	file.isRemote = isLink;
	file.isSensitive = Users.isLocalUser(user) && user.alwaysMarkNsfw ? true :
		(sensitive !== null && sensitive !== undefined)
			? sensitive
			: false;

	if (url !== null) {
		file.src = url;

		if (isLink) {
			file.url = url;
		}
	}

	if (uri !== null) {
		file.uri = uri;
	}

	if (isLink) {
		try {
			file.size = 0;
			file.md5 = hash;
			file.name = detectedName;
			file.type = mime;

			file = await DriveFiles.save(file);
		} catch (e) {
			// duplicate key error (when already registered)
			if (e.code === 11000) {
				logger.info(`already registered ${file.uri}`);

				file = await DriveFiles.findOne({
					uri: file.uri,
					userId: user.id
				});
			} else {
				logger.error(e);
				throw e;
			}
		}
	} else {
		file = await (save(file, path, detectedName, mime, hash, size));
	}

	logger.succ(`drive file has been created ${file.id}`);

	DriveFiles.pack(file).then(packedFile => {
		// Publish driveFileCreated event
		publishMainStream(user.id, 'driveFileCreated', packedFile);
		publishDriveStream(user.id, 'fileCreated', packedFile);
	});

	// 統計を更新
	driveChart.update(file, true);
	perUserDriveChart.update(file, true);
	if (file.userHost !== null) {
		instanceChart.updateDrive(file, true);
		Instances.increment({ host: file.userHost }, 'driveUsage', file.size);
		Instances.increment({ host: file.userHost }, 'driveFiles', 1);
	}

	return file;
}
