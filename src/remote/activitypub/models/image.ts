import uploadFromUrl from '../../../services/drive/upload-from-url';
import { IRemoteUser } from '../../../models/user';
import DriveFile, { DriveFile } from '../../../models/drive-file';
import Resolver from '../resolver';
import fetchMeta from '../../../misc/fetch-meta';
import { apLogger } from '../logger';

const logger = apLogger;

/**
 * Imageを作成します。
 */
export async function createImage(actor: IRemoteUser, value: any): Promise<DriveFile> {
	// 投稿者が凍結されていたらスキップ
	if (actor.isSuspended) {
		return null;
	}

	const image = await new Resolver().resolve(value) as any;

	if (image.url == null) {
		throw new Error('invalid image: url not privided');
	}

	logger.info(`Creating the Image: ${image.url}`);

	const instance = await fetchMeta();
	const cache = instance.cacheRemoteFiles;

	let file;
	try {
		file = await uploadFromUrl(image.url, actor, null, image.url, image.sensitive, false, !cache);
	} catch (e) {
		// 4xxの場合は添付されてなかったことにする
		if (e >= 400 && e < 500) {
			logger.warn(`Ignored image: ${image.url} - ${e}`);
			return null;
		}
		throw e;
	}

	if (file.metadata.isRemote) {
		// URLが異なっている場合、同じ画像が以前に異なるURLで登録されていたということなので、
		// URLを更新する
		if (file.metadata.url !== image.url) {
			file = await DriveFile.findOneAndUpdate({ _id: file.id }, {
				$set: {
					'metadata.url': image.url,
					'metadata.uri': image.url
				}
			}, {
				returnNewDocument: true
			});
		}
	}

	return file;
}

/**
 * Imageを解決します。
 *
 * Misskeyに対象のImageが登録されていればそれを返し、そうでなければ
 * リモートサーバーからフェッチしてMisskeyに登録しそれを返します。
 */
export async function resolveImage(actor: IRemoteUser, value: any): Promise<DriveFile> {
	// TODO

	// リモートサーバーからフェッチしてきて登録
	return await createImage(actor, value);
}
