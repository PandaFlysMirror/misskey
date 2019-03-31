import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import { publishMainStream } from '../../../../services/stream';
import acceptAllFollowRequests from '../../../../services/following/requests/accept-all';
import { publishToFollowers } from '../../../../services/i/update';
import define from '../../define';
import { parse, parsePlain } from '../../../../mfm/parse';
import extractEmojis from '../../../../misc/extract-emojis';
import extractHashtags from '../../../../misc/extract-hashtags';
import * as langmap from 'langmap';
import { updateHashtag } from '../../../../services/update-hashtag';
import { ApiError } from '../../error';
import { Users, DriveFiles } from '../../../../models';

export const meta = {
	desc: {
		'ja-JP': 'アカウント情報を更新します。',
		'en-US': 'Update myself'
	},

	tags: ['account'],

	requireCredential: true,

	kind: 'account-write',

	params: {
		name: {
			validator: $.optional.nullable.str.pipe(Users.isValidName),
			desc: {
				'ja-JP': '名前(ハンドルネームやニックネーム)'
			}
		},

		description: {
			validator: $.optional.nullable.str.pipe(Users.isValidDescription),
			desc: {
				'ja-JP': 'アカウントの説明や自己紹介'
			}
		},

		lang: {
			validator: $.optional.nullable.str.or(Object.keys(langmap)),
			desc: {
				'ja-JP': '言語'
			}
		},

		location: {
			validator: $.optional.nullable.str.pipe(Users.isValidLocation),
			desc: {
				'ja-JP': '住んでいる地域、所在'
			}
		},

		birthday: {
			validator: $.optional.nullable.str.pipe(Users.isValidBirthday),
			desc: {
				'ja-JP': '誕生日 (YYYY-MM-DD形式)'
			}
		},

		avatarId: {
			validator: $.optional.nullable.type(ID),
			desc: {
				'ja-JP': 'アイコンに設定する画像のドライブファイルID'
			}
		},

		bannerId: {
			validator: $.optional.nullable.type(ID),
			desc: {
				'ja-JP': 'バナーに設定する画像のドライブファイルID'
			}
		},

		isLocked: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': '鍵アカウントか否か'
			}
		},

		carefulBot: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': 'Botからのフォローを承認制にするか'
			}
		},

		autoAcceptFollowed: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': 'フォローしているユーザーからのフォローリクエストを自動承認するか'
			}
		},

		isBot: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': 'Botか否か'
			}
		},

		isCat: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': '猫か否か'
			}
		},

		autoWatch: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': '投稿の自動ウォッチをするか否か'
			}
		},

		alwaysMarkNsfw: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': 'アップロードするメディアをデフォルトで「閲覧注意」として設定するか'
			}
		},
	},

	errors: {
		noSuchAvatar: {
			message: 'No such avatar file.',
			code: 'NO_SUCH_AVATAR',
			id: '539f3a45-f215-4f81-a9a8-31293640207f'
		},

		noSuchBanner: {
			message: 'No such banner file.',
			code: 'NO_SUCH_BANNER',
			id: '0d8f5629-f210-41c2-9433-735831a58595'
		},

		avatarNotAnImage: {
			message: 'The file specified as an avatar is not an image.',
			code: 'AVATAR_NOT_AN_IMAGE',
			id: 'f419f9f8-2f4d-46b1-9fb4-49d3a2fd7191'
		},

		bannerNotAnImage: {
			message: 'The file specified as a banner is not an image.',
			code: 'BANNER_NOT_AN_IMAGE',
			id: '75aedb19-2afd-4e6d-87fc-67941256fa60'
		}
	}
};

export default define(meta, async (ps, user, app) => {
	const isSecure = user != null && app == null;

	const updates = {} as any;

	if (ps.name !== undefined) updates.name = ps.name;
	if (ps.description !== undefined) updates.description = ps.description;
	if (ps.lang !== undefined) updates.lang = ps.lang;
	if (ps.location !== undefined) updates.location = ps.location;
	if (ps.birthday !== undefined) updates.birthday = ps.birthday;
	if (ps.avatarId !== undefined) updates.avatarId = ps.avatarId;
	if (ps.bannerId !== undefined) updates.bannerId = ps.bannerId;
	if (typeof ps.isLocked == 'boolean') updates.isLocked = ps.isLocked;
	if (typeof ps.isBot == 'boolean') updates.isBot = ps.isBot;
	if (typeof ps.carefulBot == 'boolean') updates.carefulBot = ps.carefulBot;
	if (typeof ps.autoAcceptFollowed == 'boolean') updates.autoAcceptFollowed = ps.autoAcceptFollowed;
	if (typeof ps.isCat == 'boolean') updates.isCat = ps.isCat;
	if (typeof ps.autoWatch == 'boolean') updates.autoWatch = ps.autoWatch;
	if (typeof ps.alwaysMarkNsfw == 'boolean') updates.alwaysMarkNsfw = ps.alwaysMarkNsfw;

	if (ps.avatarId) {
		const avatar = await DriveFiles.findOne(ps.avatarId);

		if (avatar == null || avatar.userId !== user.id) throw new ApiError(meta.errors.noSuchAvatar);
		if (!avatar.type.startsWith('image/')) throw new ApiError(meta.errors.avatarNotAnImage);

		updates.avatarUrl = avatar.thumbnailUrl;

		if (avatar.properties.avgColor) {
			updates.avatarColor = avatar.properties.avgColor;
		}
	}

	if (ps.bannerId) {
		const banner = await DriveFiles.findOne(ps.bannerId);

		if (banner == null || banner.userId !== user.id) throw new ApiError(meta.errors.noSuchBanner);
		if (!banner.type.startsWith('image/')) throw new ApiError(meta.errors.bannerNotAnImage);

		updates.bannerUrl = banner.webpublicUrl;

		if (banner.properties.avgColor) {
			updates.bannerColor = banner.properties.avgColor;
		}
	}

	//#region emojis/tags
	if (updates.name != null || updates.description != null) {
		let emojis = [] as string[];
		let tags = [] as string[];

		if (updates.name != null) {
			const tokens = parsePlain(updates.name);
			emojis = emojis.concat(extractEmojis(tokens));
		}

		if (updates.description != null) {
			const tokens = parse(updates.description);
			emojis = emojis.concat(extractEmojis(tokens));
			tags = extractHashtags(tokens).map(tag => tag.toLowerCase());
		}

		updates.emojis = emojis;
		updates.tags = tags;

		// ハッシュタグ更新
		for (const tag of tags) updateHashtag(user, tag, true, true);
		for (const tag of user.tags.filter(x => !tags.includes(x))) updateHashtag(user, tag, true, false);
	}
	//#endregion

	await Users.update(user.id, updates);

	const iObj = await Users.pack(user.id, user, {
		detail: true,
		includeSecrets: isSecure
	});

	// Publish meUpdated event
	publishMainStream(user.id, 'meUpdated', iObj);

	// 鍵垢を解除したとき、溜まっていたフォローリクエストがあるならすべて承認
	if (user.isLocked && ps.isLocked === false) {
		acceptAllFollowRequests(user);
	}

	// フォロワーにUpdateを配信
	publishToFollowers(user.id);

	return iObj;
});
