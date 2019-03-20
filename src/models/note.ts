import { Table, Column, Model, AllowNull, BelongsTo, Default, HasMany, BelongsToMany, ForeignKey, Comment } from 'sequelize-typescript';
import * as deepcopy from 'deepcopy';
import rap from '@prezzemolo/rap';
import isObjectId from '../misc/is-objectid';
import { length } from 'stringz';
import { IUser, pack as packUser } from './user';
import { pack as packApp } from './app';
import PollVote from './poll-vote';
import NoteReaction from './note-reaction';
import { packMany as packFileMany, IDriveFile } from './drive-file';
import Following from './following';
import Emoji from './emoji';
import { dbLogger } from '../db/logger';
import { unique, concat } from '../prelude/array';
import * as Sequelize from 'sequelize';

@Table({
	indexes: [{
		unique: true,
		fields: ['uri']
	}, {
		fields: ['createdAt', 'userId', 'replyId', 'renoteId']
	}]
})
export class Note extends Model<Note> {
	@AllowNull(false)
	@Column(Sequelize.DATE)
	public createdAt: Date;

	@AllowNull(true)
	@Column(Sequelize.DATE)
	public deletedAt: Date | null;

	@AllowNull(true)
	@Column(Sequelize.DATE)
	public updatedAt: Date | null;

	@AllowNull(true)
	@ForeignKey(() => Note)
	@Column(Sequelize.INTEGER)
	public replyId: number | null;

	@AllowNull(true)
	@ForeignKey(() => Note)
	@Column(Sequelize.INTEGER)
	public renoteId: number | null;

	@AllowNull(true)
	@Column(Sequelize.TEXT)
	public text: string | null;

	@AllowNull(true)
	@Column(Sequelize.STRING)
	public name: string | null;

	@AllowNull(true)
	@Column(Sequelize.STRING)
	public cw: string | null;

	@Comment('The ID of author.')
	@AllowNull(false)
	@ForeignKey(() => User)
	@Column(Sequelize.INTEGER)
	public userId: number;

	@BelongsTo(() => User)
	public user: User;

	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public viaMobile: boolean;

	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public localOnly: boolean;

	@AllowNull(false)
	@Default(0)
	@Column(Sequelize.INTEGER)
	public renoteCount: number;

	@AllowNull(false)
	@Default(0)
	@Column(Sequelize.INTEGER)
	public repliesCount: number;

	@AllowNull(false)
	@Default({})
	@Column(Sequelize.JSONB)
	public reactionCounts: Record<string, number>;

	/**
	 * public ... 公開
	 * home ... ホームタイムライン(ユーザーページのタイムライン含む)のみに流す
	 * followers ... フォロワーのみ
	 * specified ... visibleUserIds で指定したユーザーのみ
	 */
	@Column({ type: Sequelize.ENUM, values: ['public', 'home', 'followers', 'specified'] })
	public visibility: 'public' | 'home' | 'followers' | 'specified';

	@Comment('The URI of a note. it will be null when the note is local.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public uri: string | null;

	@AllowNull(false)
	@Default(0)
	@Column(Sequelize.INTEGER)
	public score: number;
/*
	@BelongsToMany(() => DriveFile, () => NoteDriveFileAttaching)
	public files: DriveFile[];*/
}

export const hideNote = async (packedNote: any, meId: mongo.ObjectID) => {
	let hide = false;

	// visibility が private かつ投稿者のIDが自分のIDではなかったら非表示(後方互換性のため)
	if (packedNote.visibility == 'private' && (meId == null || !meId.equals(packedNote.userId))) {
		hide = true;
	}

	// visibility が specified かつ自分が指定されていなかったら非表示
	if (packedNote.visibility == 'specified') {
		if (meId == null) {
			hide = true;
		} else if (meId.equals(packedNote.userId)) {
			hide = false;
		} else {
			// 指定されているかどうか
			const specified = packedNote.visibleUserIds.some((id: any) => meId.equals(id));

			if (specified) {
				hide = false;
			} else {
				hide = true;
			}
		}
	}

	// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
	if (packedNote.visibility == 'followers') {
		if (meId == null) {
			hide = true;
		} else if (meId.equals(packedNote.userId)) {
			hide = false;
		} else if (packedNote.reply && meId.equals(packedNote.reply.userId)) {
			// 自分の投稿に対するリプライ
			hide = false;
		} else if (packedNote.mentions && packedNote.mentions.some((id: any) => meId.equals(id))) {
			// 自分へのメンション
			hide = false;
		} else {
			// フォロワーかどうか
			const following = await Following.findOne({
				followeeId: packedNote.userId,
				followerId: meId
			});

			if (following == null) {
				hide = true;
			} else {
				hide = false;
			}
		}
	}

	if (hide) {
		packedNote.fileIds = [];
		packedNote.files = [];
		packedNote.text = null;
		packedNote.poll = null;
		packedNote.cw = null;
		packedNote.tags = [];
		packedNote.geo = null;
		packedNote.isHidden = true;
	}
};

export const packMany = (
	notes: (string | mongo.ObjectID | INote)[],
	me?: string | mongo.ObjectID | IUser,
	options?: {
		detail?: boolean;
		skipHide?: boolean;
	}
) => {
	return Promise.all(notes.map(n => pack(n, me, options)));
};

/**
 * Pack a note for API response
 *
 * @param note target
 * @param me? serializee
 * @param options? serialize options
 * @return response
 */
export const pack = async (
	note: string | mongo.ObjectID | INote,
	me?: string | mongo.ObjectID | IUser,
	options?: {
		detail?: boolean;
		skipHide?: boolean;
	}
) => {
	const opts = Object.assign({
		detail: true,
		skipHide: false
	}, options);

	// Me
	const meId: mongo.ObjectID = me
		? isObjectId(me)
			? me as mongo.ObjectID
			: typeof me === 'string'
				? new mongo.ObjectID(me)
				: (me as IUser)._id
		: null;

	let _note: any;

	// Populate the note if 'note' is ID
	if (isObjectId(note)) {
		_note = await Note.findOne({
			_id: note
		});
	} else if (typeof note === 'string') {
		_note = await Note.findOne({
			_id: new mongo.ObjectID(note)
		});
	} else {
		_note = deepcopy(note);
	}

	// (データベースの欠損などで)投稿がデータベース上に見つからなかったとき
	if (_note == null) {
		dbLogger.warn(`[DAMAGED DB] (missing) pkg: note :: ${note}`);
		return null;
	}

	const id = _note._id;

	// Some counts
	_note.renoteCount = _note.renoteCount || 0;
	_note.repliesCount = _note.repliesCount || 0;
	_note.reactionCounts = _note.reactionCounts || {};

	// _note._userを消す前か、_note.userを解決した後でないとホストがわからない
	if (_note._user) {
		const host = _note._user.host;
		// 互換性のため。(古いMisskeyではNoteにemojisが無い)
		if (_note.emojis == null) {
			_note.emojis = Emoji.find({
				host: host
			}, {
				fields: { _id: false }
			});
		} else {
			_note.emojis = unique(concat([_note.emojis, Object.keys(_note.reactionCounts)]));

			_note.emojis = Emoji.find({
				name: { $in: _note.emojis },
				host: host
			}, {
				fields: { _id: false }
			});
		}
	}

	// Rename _id to id
	_note.id = _note._id;
	delete _note._id;

	delete _note.prev;
	delete _note.next;
	delete _note.tagsLower;
	delete _note.score;
	delete _note._user;
	delete _note._reply;
	delete _note._renote;
	delete _note._files;
	delete _note._replyIds;
	delete _note.mentionedRemoteUsers;

	if (_note.geo) delete _note.geo.type;

	// Populate user
	_note.user = packUser(_note.userId, meId);

	// Populate app
	if (_note.appId) {
		_note.app = packApp(_note.appId);
	}

	// Populate files
	_note.files = packFileMany(_note.fileIds || []);

	// 後方互換性のため
	_note.mediaIds = _note.fileIds;
	_note.media = _note.files;

	// When requested a detailed note data
	if (opts.detail) {
		if (_note.replyId) {
			// Populate reply to note
			_note.reply = pack(_note.replyId, meId, {
				detail: false
			});
		}

		if (_note.renoteId) {
			// Populate renote
			_note.renote = pack(_note.renoteId, meId, {
				detail: _note.text == null
			});
		}

		// Poll
		if (meId && _note.poll) {
			_note.poll = (async poll => {
				if (poll.multiple) {
					const votes = await PollVote.find({
						userId: meId,
						noteId: id
					});

					const myChoices = (poll.choices as IChoice[]).filter(x => votes.some(y => x.id == y.choice));
					for (const myChoice of myChoices) {
						(myChoice as any).isVoted = true;
					}

					return poll;
				} else {
					poll.multiple = false;
				}

				const vote = await PollVote
					.findOne({
						userId: meId,
						noteId: id
					});

				if (vote) {
					const myChoice = (poll.choices as IChoice[])
						.filter(x => x.id == vote.choice)[0] as any;

					myChoice.isVoted = true;
				}

				return poll;
			})(_note.poll);
		}

		if (meId) {
			// Fetch my reaction
			_note.myReaction = (async () => {
				const reaction = await NoteReaction
					.findOne({
						userId: meId,
						noteId: id,
						deletedAt: { $exists: false }
					});

				if (reaction) {
					return reaction.reaction;
				}

				return null;
			})();
		}
	}

	// resolve promises in _note object
	_note = await rap(_note);

	//#region (データベースの欠損などで)参照しているデータがデータベース上に見つからなかったとき
	if (_note.user == null) {
		dbLogger.warn(`[DAMAGED DB] (missing) pkg: note -> user :: ${_note.id} (user ${_note.userId})`);
		return null;
	}

	if (opts.detail) {
		if (_note.replyId != null && _note.reply == null) {
			dbLogger.warn(`[DAMAGED DB] (missing) pkg: note -> reply :: ${_note.id} (reply ${_note.replyId})`);
			return null;
		}

		if (_note.renoteId != null && _note.renote == null) {
			dbLogger.warn(`[DAMAGED DB] (missing) pkg: note -> renote :: ${_note.id} (renote ${_note.renoteId})`);
			return null;
		}
	}
	//#endregion

	if (_note.name) {
		_note.text = `【${_note.name}】\n${_note.text}`;
	}

	if (_note.user.isCat && _note.text) {
		_note.text = (_note.text
			// ja-JP
			.replace(/な/g, 'にゃ').replace(/ナ/g, 'ニャ').replace(/ﾅ/g, 'ﾆｬ')
			// ko-KR
			.replace(/[나-낳]/g, (match: string) => String.fromCharCode(
				match.codePointAt(0)  + '냐'.charCodeAt(0) - '나'.charCodeAt(0)
			))
		);
	}

	if (!opts.skipHide) {
		await hideNote(_note, meId);
	}

	return _note;
};
