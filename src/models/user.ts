import * as Sequelize from 'sequelize';
import { Table, Column, Model, AllowNull, Comment, Default, ForeignKey } from 'sequelize-typescript';
import * as deepcopy from 'deepcopy';
import rap from '@prezzemolo/rap';
import { packMany as packNoteMany } from './note';
import Following from './following';
import Blocking from './blocking';
import Mute from './mute';
import { getFriendIds } from '../server/api/common/get-friends';
import config from '../config';
import FollowRequest from './follow-request';
import fetchMeta from '../misc/fetch-meta';
import Emoji from './emoji';
import { dbLogger } from '../db/logger';

@Table({
	indexes: [{
		unique: true,
		fields: ['token']
	}, {
		unique: true,
		fields: ['uri']
	}, {
		unique: true,
		fields: ['username', 'host']
	}, {
		fields: ['createdAt']
	}, {
		fields: ['updatedAt']
	}, {
		fields: ['username']
	}, {
		fields: ['host']
	}]
})
export class User extends Model<User> {
	@AllowNull(false)
	@Column(Sequelize.DATE)
	public createdAt: Date;

	@AllowNull(true)
	@Column(Sequelize.DATE)
	public updatedAt: Date | null;

	@Comment('The username of the User.')
	@AllowNull(false)
	@Column(Sequelize.STRING)
	public username: string;

	@Comment('The name of the User.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public name: string | null;

	@Comment('The location of the User.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public location: string | null;

	@Comment('The birthday (YYYY-MM-DD) of the User.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public birthday: string | null;

	@Comment('The count of followers.')
	@AllowNull(false)
	@Default(0)
	@Column(Sequelize.INTEGER)
	public followersCount: number;

	@Comment('The count of following.')
	@AllowNull(false)
	@Default(0)
	@Column(Sequelize.INTEGER)
	public followingCount: number;

	@Comment('The count of notes.')
	@AllowNull(false)
	@Default(0)
	@Column(Sequelize.INTEGER)
	public notesCount: number;

	@Comment('The ID of avatar DriveFile.')
	@AllowNull(true)
	@ForeignKey(() => DriveFile)
	@Column(Sequelize.INTEGER)
	public avatarId: number | null;

	@Comment('The ID of banner DriveFile.')
	@AllowNull(true)
	@ForeignKey(() => DriveFile)
	@Column(Sequelize.INTEGER)
	public bannerId: number | null;

	@Comment('The description (bio) of the User.')
	@AllowNull(true)
	@Column(Sequelize.TEXT)
	public description: string | null;

	@Comment('The email address of the User.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public email: string | null;

	@Comment('Whether the User is suspended.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isSuspended: boolean;

	@Comment('Whether the User is silenced.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isSilenced: boolean;

	@Comment('Whether the User is locked.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isLocked: boolean;

	@Comment('Whether the User is a bot.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isBot: boolean;

	@Comment('Whether the User is a cat.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isCat: boolean;

	@Comment('Whether the User is the admin.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isAdmin: boolean;

	@Comment('Whether the User is a moderator.')
	@AllowNull(false)
	@Default(false)
	@Column(Sequelize.BOOLEAN)
	public isModerator: boolean;

	@Comment('The host of the User. It will be null if the origin of the user is local.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public host: string | null;

	@Comment('The password hash of the User. It will be null if the origin of the user is local.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public password: string | null;

	@Comment('The native access token of the User. It will be null if the origin of the user is local.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public token: string | null;

	@Comment('The keypair of the User. It will be null if the origin of the user is local.')
	@AllowNull(true)
	@Column(Sequelize.STRING)
	public keypair: string | null;

	@Comment('The client-specific data of the User.')
	@AllowNull(false)
	@Default({})
	@Column(Sequelize.JSONB)
	public clientData: Record<string, any>;

	@Comment('The external service links of the User.')
	@AllowNull(false)
	@Default({})
	@Column(Sequelize.JSONB)
	public services: Record<string, any>;
}

type IUserBase = {
	_id: mongo.ObjectID;
	createdAt: Date;
	updatedAt?: Date;
	deletedAt?: Date;
	followersCount: number;
	followingCount: number;
	name?: string;
	notesCount: number;
	username: string;
	usernameLower: string;
	avatarId: mongo.ObjectID;
	bannerId: mongo.ObjectID;
	avatarUrl?: string;
	bannerUrl?: string;
	avatarColor?: any;
	bannerColor?: any;
	wallpaperId: mongo.ObjectID;
	wallpaperUrl?: string;
	data: any;
	description: string;
	lang?: string;
	pinnedNoteIds: mongo.ObjectID[];
	emojis?: string[];
	tags?: string[];

	isDeleted: boolean;

	/**
	 * 凍結されているか否か
	 */
	isSuspended: boolean;

	/**
	 * サイレンスされているか否か
	 */
	isSilenced: boolean;

	/**
	 * 鍵アカウントか否か
	 */
	isLocked: boolean;

	/**
	 * Botか否か
	 */
	isBot: boolean;

	/**
	 * Botからのフォローを承認制にするか
	 */
	carefulBot: boolean;

	/**
	 * フォローしているユーザーからのフォローリクエストを自動承認するか
	 */
	autoAcceptFollowed: boolean;

	/**
	 * このアカウントに届いているフォローリクエストの数
	 */
	pendingReceivedFollowRequestsCount: number;

	host: string;
};

export interface ILocalUser extends IUserBase {
	host: null;
	keypair: string;
	email: string;
	emailVerified?: boolean;
	emailVerifyCode?: string;
	password: string;
	token: string;
	twitter: {
		accessToken: string;
		accessTokenSecret: string;
		userId: string;
		screenName: string;
	};
	github: {
		accessToken: string;
		id: string;
		login: string;
	};
	discord: {
		accessToken: string;
		refreshToken: string;
		expiresDate: number;
		id: string;
		username: string;
		discriminator: string;
	};
	profile: {
		location: string;
		birthday: string; // 'YYYY-MM-DD'
		tags: string[];
	};
	fields?: {
		name: string;
		value: string;
	}[];
	isCat: boolean;
	isAdmin?: boolean;
	isModerator?: boolean;
	isVerified?: boolean;
	twoFactorSecret: string;
	twoFactorEnabled: boolean;
	twoFactorTempSecret?: string;
	clientSettings: any;
	settings: {
		autoWatch: boolean;
		alwaysMarkNsfw?: boolean;
	};
	hasUnreadNotification: boolean;
	hasUnreadMessagingMessage: boolean;
}

export interface IRemoteUser extends IUserBase {
	inbox: string;
	sharedInbox?: string;
	featured?: string;
	endpoints: string[];
	uri: string;
	url?: string;
	publicKey: {
		id: string;
		publicKeyPem: string;
	};
	lastFetchedAt: Date;
	isAdmin: false;
	isModerator: false;
}

export type IUser = ILocalUser | IRemoteUser;

export const isLocalUser = (user: any): user is ILocalUser =>
	user.host === null;

export const isRemoteUser = (user: any): user is IRemoteUser =>
	!isLocalUser(user);

//#region Validators
export function validateUsername(username: string, remote = false): boolean {
	return typeof username == 'string' && (remote ? /^\w([\w-]*\w)?$/ : /^\w{1,20}$/).test(username);
}

export function validatePassword(password: string): boolean {
	return typeof password == 'string' && password != '';
}

export function isValidName(name?: string): boolean {
	return name === null || (typeof name == 'string' && name.length < 50 && name.trim() != '');
}

export function isValidDescription(description: string): boolean {
	return typeof description == 'string' && description.length < 500 && description.trim() != '';
}

export function isValidLocation(location: string): boolean {
	return typeof location == 'string' && location.length < 50 && location.trim() != '';
}

export function isValidBirthday(birthday: string): boolean {
	return typeof birthday == 'string' && /^([0-9]{4})\-([0-9]{2})-([0-9]{2})$/.test(birthday);
}
//#endregion

export async function getRelation(me: mongo.ObjectId, target: mongo.ObjectId) {
	const [following1, following2, followReq1, followReq2, toBlocking, fromBlocked, mute] = await Promise.all([
		Following.findOne({
			followerId: me,
			followeeId: target
		}),
		Following.findOne({
			followerId: target,
			followeeId: me
		}),
		FollowRequest.findOne({
			followerId: me,
			followeeId: target
		}),
		FollowRequest.findOne({
			followerId: target,
			followeeId: me
		}),
		Blocking.findOne({
			blockerId: me,
			blockeeId: target
		}),
		Blocking.findOne({
			blockerId: target,
			blockeeId: me
		}),
		Mute.findOne({
			muterId: me,
			muteeId: target
		})
	]);

	return {
		id: target,
		isFollowing: following1 !== null,
		hasPendingFollowRequestFromYou: followReq1 !== null,
		hasPendingFollowRequestToYou: followReq2 !== null,
		isFollowed: following2 !== null,
		isBlocking: toBlocking !== null,
		isBlocked: fromBlocked !== null,
		isMuted: mute !== null
	};
}

/**
 * Pack a user for API response
 *
 * @param user target
 * @param me? serializee
 * @param options? serialize options
 * @return Packed user
 */
export const pack = (
	user: string | mongo.ObjectID | IUser,
	me?: string | mongo.ObjectID | IUser,
	options?: {
		detail?: boolean,
		includeSecrets?: boolean,
		includeHasUnreadNotes?: boolean
	}
) => new Promise<any>(async (resolve, reject) => {
	const opts = Object.assign({
		detail: false,
		includeSecrets: false
	}, options);

	let _user: any;

	const fields = opts.detail ? {} : {
		name: true,
		username: true,
		host: true,
		avatarColor: true,
		avatarUrl: true,
		emojis: true,
		isCat: true,
		isBot: true,
		isAdmin: true,
		isVerified: true
	};

	// Populate the user if 'user' is ID
	if (isObjectId(user)) {
		_user = await User.findOne({
			_id: user
		}, { fields });
	} else if (typeof user === 'string') {
		_user = await User.findOne({
			_id: new mongo.ObjectID(user)
		}, { fields });
	} else {
		_user = deepcopy(user);
	}

	// (データベースの欠損などで)ユーザーがデータベース上に見つからなかったとき
	if (_user == null) {
		dbLogger.warn(`user not found on database: ${user}`);
		return resolve(null);
	}

	// Me
	const meId: mongo.ObjectID = me
		? isObjectId(me)
			? me as mongo.ObjectID
			: typeof me === 'string'
				? new mongo.ObjectID(me)
				: (me as IUser)._id
		: null;

	// Rename _id to id
	_user.id = _user._id;
	delete _user._id;

	delete _user.usernameLower;
	delete _user.emailVerifyCode;

	if (_user.host == null) {
		// Remove private properties
		delete _user.keypair;
		delete _user.password;
		delete _user.token;
		delete _user.twoFactorTempSecret;
		delete _user.two_factor_temp_secret; // 後方互換性のため
		delete _user.twoFactorSecret;
		if (_user.twitter) {
			delete _user.twitter.accessToken;
			delete _user.twitter.accessTokenSecret;
		}
		if (_user.github) {
			delete _user.github.accessToken;
		}
		if (_user.discord) {
			delete _user.discord.accessToken;
			delete _user.discord.refreshToken;
			delete _user.discord.expiresDate;
		}

		// Visible via only the official client
		if (!opts.includeSecrets) {
			delete _user.email;
			delete _user.emailVerified;
			delete _user.settings;
			delete _user.clientSettings;
		}

		if (!opts.detail) {
			delete _user.twoFactorEnabled;
		}
	} else {
		delete _user.publicKey;
	}

	if (_user.avatarUrl == null) {
		_user.avatarUrl = `${config.driveUrl}/default-avatar.jpg`;
	}

	if (!meId || !meId.equals(_user.id) || !opts.detail) {
		delete _user.avatarId;
		delete _user.bannerId;
		delete _user.hasUnreadMessagingMessage;
		delete _user.hasUnreadNotification;
	}

	if (meId && !meId.equals(_user.id) && opts.detail) {
		const relation = await getRelation(meId, _user.id);

		_user.isFollowing = relation.isFollowing;
		_user.isFollowed = relation.isFollowed;
		_user.hasPendingFollowRequestFromYou = relation.hasPendingFollowRequestFromYou;
		_user.hasPendingFollowRequestToYou = relation.hasPendingFollowRequestToYou;
		_user.isBlocking = relation.isBlocking;
		_user.isBlocked = relation.isBlocked;
		_user.isMuted = relation.isMuted;
	}

	if (opts.detail) {
		if (_user.pinnedNoteIds) {
			// Populate pinned notes
			_user.pinnedNotes = packNoteMany(_user.pinnedNoteIds, meId, {
				detail: true
			});
		}

		if (meId && !meId.equals(_user.id)) {
			const myFollowingIds = await getFriendIds(meId);

			// Get following you know count
			_user.followingYouKnowCount = Following.count({
				followeeId: { $in: myFollowingIds },
				followerId: _user.id
			});

			// Get followers you know count
			_user.followersYouKnowCount = Following.count({
				followeeId: _user.id,
				followerId: { $in: myFollowingIds }
			});
		}
	}

	if (!opts.includeHasUnreadNotes) {
		delete _user.hasUnreadSpecifiedNotes;
		delete _user.hasUnreadMentions;
	}

	// カスタム絵文字添付
	if (_user.emojis) {
		_user.emojis = Emoji.find({
			name: { $in: _user.emojis },
			host: _user.host
		}, {
			fields: { _id: false }
		});
	}

	// resolve promises in _user object
	_user = await rap(_user);

	resolve(_user);
});

/*
function img(url) {
	return {
		thumbnail: {
			large: `${url}`,
			medium: '',
			small: ''
		}
	};
}
*/

export async function fetchProxyAccount(): Promise<ILocalUser> {
	const meta = await fetchMeta();
	return await User.findOne({ username: meta.proxyAccount, host: null }) as ILocalUser;
}
