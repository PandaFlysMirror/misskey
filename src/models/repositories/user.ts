import { EntityRepository, Repository, In } from 'typeorm';
import { User, ILocalUser, IRemoteUser } from '../entities/user';
import { Emojis, Notes, NoteUnreads, FollowRequests, Notifications, MessagingMessages, UserNotePinings, Followings, Blockings, Mutings } from '..';
import rap from '@prezzemolo/rap';

@EntityRepository(User)
export class UserRepository extends Repository<User> {
	public async getRelation(me: User['id'], target: User['id']) {
		const [following1, following2, followReq1, followReq2, toBlocking, fromBlocked, mute] = await Promise.all([
			Followings.findOne({
				followerId: me,
				followeeId: target
			}),
			Followings.findOne({
				followerId: target,
				followeeId: me
			}),
			FollowRequests.findOne({
				followerId: me,
				followeeId: target
			}),
			FollowRequests.findOne({
				followerId: target,
				followeeId: me
			}),
			Blockings.findOne({
				blockerId: me,
				blockeeId: target
			}),
			Blockings.findOne({
				blockerId: target,
				blockeeId: me
			}),
			Mutings.findOne({
				muterId: me,
				muteeId: target
			})
		]);

		return {
			id: target,
			isFollowing: following1 != null,
			hasPendingFollowRequestFromYou: followReq1 != null,
			hasPendingFollowRequestToYou: followReq2 != null,
			isFollowed: following2 != null,
			isBlocking: toBlocking != null,
			isBlocked: fromBlocked != null,
			isMuted: mute != null
		};
	}

	public async pack(
		src: User['id'] | User,
		me?: User['id'] | User,
		options?: {
			detail?: boolean,
			includeSecrets?: boolean,
			includeHasUnreadNotes?: boolean
		}
	): Promise<Record<string, any>> {
		const opts = Object.assign({
			detail: false,
			includeSecrets: false
		}, options);

		const user = typeof src === 'object' ? src : await this.findOne(src);
		const meId = me ? typeof me === 'string' ? me : me.id : null;

		const relation = meId && (meId !== user.id) && opts.detail ? await this.getRelation(meId, user.id) : null;

		return await rap({
			id: user.id,
			name: user.name,
			username: user.username,
			host: user.host,
			avatarUrl: user.avatarUrl,
			bannerUrl: user.bannerUrl,
			avatarColor: user.avatarColor,
			bannerColor: user.bannerColor,
			isAdmin: user.isAdmin,

			// カスタム絵文字添付
			emojis: user.emojis.length > 0 ? Emojis.find({
				where: {
					name: In(user.emojis),
					host: user.host
				},
				select: ['name', 'host', 'url', 'aliases']
			}) : [],

			...(opts.includeHasUnreadNotes ? {
				hasUnreadSpecifiedNotes: NoteUnreads.count({
					where: { userId: user.id, isSpecified: true },
					take: 1
				}).then(count => count > 0),
				hasUnreadMentions: NoteUnreads.count({
					where: { userId: user.id },
					take: 1
				}).then(count => count > 0),
			} : {}),

			...(opts.detail ? {
				followersCount: user.followersCount,
				followingCount: user.followingCount,
				notesCount: user.notesCount,
				pinnedNotes: UserNotePinings.find({ userId: user.id }).then(pins =>
					Notes.packMany(pins.map(pin => pin.id), meId, {
						detail: true
					})),
			} : {}),

			...(opts.detail && meId === user.id ? {
				avatarId: user.avatarId,
				bannerId: user.bannerId,
				autoWatch: user.autoWatch,
				alwaysMarkNsfw: user.alwaysMarkNsfw,
				carefulBot: user.carefulBot,
				hasUnreadMessagingMessage: MessagingMessages.count({
					where: {
						recipientId: user.id,
						isRead: false
					},
					take: 1
				}).then(count => count > 0),
				hasUnreadNotification: Notifications.count({
					where: {
						userId: user.id,
						isRead: false
					},
					take: 1
				}).then(count => count > 0),
				pendingReceivedFollowRequestsCount: FollowRequests.count({
					followeeId: user.id
				}),
			} : {}),

			...(relation ? {
				isFollowing: relation.isFollowing,
				isFollowed: relation.isFollowed,
				hasPendingFollowRequestFromYou: relation.hasPendingFollowRequestFromYou,
				hasPendingFollowRequestToYou: relation.hasPendingFollowRequestToYou,
				isBlocking: relation.isBlocking,
				isBlocked: relation.isBlocked,
				isMuted: relation.isMuted,
			} : {})
		});
	}

	public isLocalUser(user: User): user is ILocalUser {
		return user.host === null;
	}

	public isRemoteUser(user: User): user is IRemoteUser {
		return !this.isLocalUser(user);
	}

	//#region Validators
	public validateUsername(username: string, remote = false): boolean {
		return typeof username == 'string' && (remote ? /^\w([\w-]*\w)?$/ : /^\w{1,20}$/).test(username);
	}

	public validatePassword(password: string): boolean {
		return typeof password == 'string' && password != '';
	}

	public isValidName(name?: string): boolean {
		return name === null || (typeof name == 'string' && name.length < 50 && name.trim() != '');
	}

	public isValidDescription(description: string): boolean {
		return typeof description == 'string' && description.length < 500 && description.trim() != '';
	}

	public isValidLocation(location: string): boolean {
		return typeof location == 'string' && location.length < 50 && location.trim() != '';
	}

	public isValidBirthday(birthday: string): boolean {
		return typeof birthday == 'string' && /^([0-9]{4})\-([0-9]{2})-([0-9]{2})$/.test(birthday);
	}
	//#endregion
}
