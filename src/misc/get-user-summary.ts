import { User, isLocalUser } from '../models/user';
import getAcct from './acct/render';
import getUserName from './get-user-name';

/**
 * ユーザーを表す文字列を取得します。
 * @param user ユーザー
 */
export default function(user: User): string {
	let string = `${getUserName(user)} (@${getAcct(user)})\n` +
		`${user.notesCount}投稿、${user.followingCount}フォロー、${user.followersCount}フォロワー\n`;

	if (isLocalUser(user)) {
		string += `場所: ${user.profile.location}、誕生日: ${user.profile.birthday}\n`;
	}

	return string + `「${user.description}」`;
}
