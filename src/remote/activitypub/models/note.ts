import * as promiseLimit from 'promise-limit';

import config from '../../../config';
import Resolver from '../resolver';
import post from '../../../services/note/create';
import { resolvePerson, updatePerson } from './person';
import { resolveImage } from './image';
import { IRemoteUser, User } from '../../../models/entities/user';
import { fromHtml } from '../../../mfm/fromHtml';
import { ITag, extractHashtags } from './tag';
import { toUnicode } from 'punycode';
import { unique, concat, difference } from '../../../prelude/array';
import { extractPollFromQuestion } from './question';
import vote from '../../../services/note/polls/vote';
import { apLogger } from '../logger';
import { DriveFile } from '../../../models/entities/drive-file';
import { deliverQuestionUpdate } from '../../../services/note/polls/update';
import { extractDbHost } from '../../../misc/convert-host';
import { Notes, Emojis, Polls } from '../../../models';
import { Note } from '../../../models/entities/note';
import { IObject, INote } from '../type';
import { Emoji } from '../../../models/entities/emoji';
import { genId } from '../../../misc/gen-id';
import fetchMeta from '../../../misc/fetch-meta';

const logger = apLogger;

/**
 * Noteをフェッチします。
 *
 * Misskeyに対象のNoteが登録されていればそれを返します。
 */
export async function fetchNote(value: string | IObject, resolver?: Resolver): Promise<Note> {
	const uri = typeof value == 'string' ? value : value.id;

	// URIがこのサーバーを指しているならデータベースからフェッチ
	if (uri.startsWith(config.url + '/')) {
		const id = uri.split('/').pop();
		return await Notes.findOne(id);
	}

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await Notes.findOne({ uri });

	if (exist) {
		return exist;
	}
	//#endregion

	return null;
}

/**
 * Noteを作成します。
 */
export async function createNote(value: any, resolver?: Resolver, silent = false): Promise<Note> {
	if (resolver == null) resolver = new Resolver();

	const object: any = await resolver.resolve(value);

	if (!object || !['Note', 'Question', 'Article'].includes(object.type)) {
		logger.error(`invalid note: ${value}`, {
			resolver: {
				history: resolver.getHistory()
			},
			value: value,
			object: object
		});
		return null;
	}

	const note: INote = object;

	logger.debug(`Note fetched: ${JSON.stringify(note, null, 2)}`);

	logger.info(`Creating the Note: ${note.id}`);

	// 投稿者をフェッチ
	const actor = await resolvePerson(note.attributedTo, null, resolver) as IRemoteUser;

	// 投稿者が凍結されていたらスキップ
	if (actor.isSuspended) {
		return null;
	}

	//#region Visibility
	note.to = note.to == null ? [] : typeof note.to == 'string' ? [note.to] : note.to;
	note.cc = note.cc == null ? [] : typeof note.cc == 'string' ? [note.cc] : note.cc;

	let visibility = 'public';
	let visibleUsers: User[] = [];
	if (!note.to.includes('https://www.w3.org/ns/activitystreams#Public')) {
		if (note.cc.includes('https://www.w3.org/ns/activitystreams#Public')) {
			visibility = 'home';
		} else if (note.to.includes(`${actor.uri}/followers`)) {	// TODO: person.followerと照合するべき？
			visibility = 'followers';
		} else {
			visibility = 'specified';
			visibleUsers = await Promise.all(note.to.map(uri => resolvePerson(uri, null, resolver)));
		}
}
	//#endergion

	const apMentions = await extractMentionedUsers(actor, note.to, note.cc, resolver);

	const apHashtags = await extractHashtags(note.tag);

	// 添付ファイル
	// TODO: attachmentは必ずしもImageではない
	// TODO: attachmentは必ずしも配列ではない
	// Noteがsensitiveなら添付もsensitiveにする
	const limit = promiseLimit(2);

	note.attachment = Array.isArray(note.attachment) ? note.attachment : note.attachment ? [note.attachment] : [];
	const files = note.attachment
		.map(attach => attach.sensitive = note.sensitive)
		? (await Promise.all(note.attachment.map(x => limit(() => resolveImage(actor, x)) as Promise<DriveFile>)))
			.filter(image => image != null)
		: [];

	// リプライ
	const reply: Note = note.inReplyTo
		? await resolveNote(note.inReplyTo, resolver).catch(e => {
			// 4xxの場合はリプライしてないことにする
			if (e.statusCode >= 400 && e.statusCode < 500) {
				logger.warn(`Ignored inReplyTo ${note.inReplyTo} - ${e.statusCode} `);
				return null;
			}
			logger.warn(`Error in inReplyTo ${note.inReplyTo} - ${e.statusCode || e}`);
			throw e;
		})
		: null;

	// 引用
	let quote: Note;

	if (note._misskey_quote && typeof note._misskey_quote == 'string') {
		quote = await resolveNote(note._misskey_quote).catch(e => {
			// 4xxの場合は引用してないことにする
			if (e.statusCode >= 400 && e.statusCode < 500) {
				logger.warn(`Ignored quote target ${note.inReplyTo} - ${e.statusCode} `);
				return null;
			}
			logger.warn(`Error in quote target ${note.inReplyTo} - ${e.statusCode || e}`);
			throw e;
		});
	}

	const cw = note.summary === '' ? null : note.summary;

	// テキストのパース
	const text = note._misskey_content || fromHtml(note.content);

	// vote
	if (reply && reply.hasPoll) {
		const poll = await Polls.findOne({ noteId: reply.id });
		const tryCreateVote = async (name: string, index: number): Promise<null> => {
			if (poll.expiresAt && Date.now() > new Date(poll.expiresAt).getTime()) {
				logger.warn(`vote to expired poll from AP: actor=${actor.username}@${actor.host}, note=${note.id}, choice=${name}`);
			} else if (index >= 0) {
				logger.info(`vote from AP: actor=${actor.username}@${actor.host}, note=${note.id}, choice=${name}`);
				await vote(actor, reply, index);

				// リモートフォロワーにUpdate配信
				deliverQuestionUpdate(reply.id);
			}
			return null;
		};

		if (note.name) {
			return await tryCreateVote(note.name, poll.choices.findIndex(x => x === note.name));
		}

		// 後方互換性のため
		if (text) {
			const m = text.match(/(\d+)$/);

			if (m) {
				return await tryCreateVote(m[0], Number(m[1]));
			}
		}
	}

	const emojis = await extractEmojis(note.tag, actor.host).catch(e => {
		logger.info(`extractEmojis: ${e}`);
		return [] as Emoji[];
	});

	const apEmojis = emojis.map(emoji => emoji.name);

	const questionUri = note._misskey_question;
	const poll = await extractPollFromQuestion(note._misskey_question || note).catch(() => undefined);

	// ユーザーの情報が古かったらついでに更新しておく
	if (actor.lastFetchedAt == null || Date.now() - actor.lastFetchedAt.getTime() > 1000 * 60 * 60 * 24) {
		updatePerson(note.attributedTo);
	}

	return await post(actor, {
		createdAt: new Date(note.published),
		files,
		reply,
		renote: quote,
		name: note.name,
		cw,
		text,
		viaMobile: false,
		localOnly: false,
		geo: undefined,
		visibility,
		visibleUsers,
		apMentions,
		apHashtags,
		apEmojis,
		questionUri,
		poll,
		uri: note.id
	}, silent);
}

/**
 * Noteを解決します。
 *
 * Misskeyに対象のNoteが登録されていればそれを返し、そうでなければ
 * リモートサーバーからフェッチしてMisskeyに登録しそれを返します。
 */
export async function resolveNote(value: string | IObject, resolver?: Resolver): Promise<Note> {
	const uri = typeof value == 'string' ? value : value.id;

	// ブロックしてたら中断
	// TODO: いちいちデータベースにアクセスするのはコスト高そうなのでどっかにキャッシュしておく
	const meta = await fetchMeta();
	if (meta.blockedHosts.includes(extractDbHost(uri))) throw { statusCode: 451 };

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await fetchNote(uri);

	if (exist) {
		return exist;
	}
	//#endregion

	// リモートサーバーからフェッチしてきて登録
	// ここでuriの代わりに添付されてきたNote Objectが指定されていると、サーバーフェッチを経ずにノートが生成されるが
	// 添付されてきたNote Objectは偽装されている可能性があるため、常にuriを指定してサーバーフェッチを行う。
	return await createNote(uri, resolver);
}

export async function extractEmojis(tags: ITag[], host_: string) {
	const host = toUnicode(host_.toLowerCase());

	if (!tags) return [];

	const eomjiTags = tags.filter(tag => tag.type === 'Emoji' && tag.icon && tag.icon.url);

	return await Promise.all(
		eomjiTags.map(async tag => {
			const name = tag.name.replace(/^:/, '').replace(/:$/, '');

			const exists = await Emojis.findOne({
				host,
				name
			});

			if (exists) {
				if ((tag.updated != null && exists.updatedAt == null)
					|| (tag.id != null && exists.uri == null)
					|| (tag.updated != null && exists.updatedAt != null && new Date(tag.updated) > exists.updatedAt)
				) {
					await Emojis.update({
						host,
						name,
					}, {
						uri: tag.id,
						url: tag.icon.url,
						updatedAt: new Date(tag.updated),
					});

					return await Emojis.findOne({
						host,
						name
					});
				}

				return exists;
			}

			logger.info(`register emoji host=${host}, name=${name}`);

			return await Emojis.save({
				id: genId(),
				host,
				name,
				uri: tag.id,
				url: tag.icon.url,
				updatedAt: tag.updated ? new Date(tag.updated) : undefined,
				aliases: []
			} as Emoji);
		})
	);
}

async function extractMentionedUsers(actor: IRemoteUser, to: string[], cc: string[], resolver: Resolver) {
	const ignoreUris = ['https://www.w3.org/ns/activitystreams#Public', `${actor.uri}/followers`];
	const uris = difference(unique(concat([to || [], cc || []])), ignoreUris);

	const limit = promiseLimit(2);
	const users = await Promise.all(
		uris.map(uri => limit(() => resolvePerson(uri, null, resolver).catch(() => null)) as Promise<User>)
	);

	return users.filter(x => x != null);
}
