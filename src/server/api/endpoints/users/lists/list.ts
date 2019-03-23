import UserList, { pack } from '../../../../../models/entities/user-list';
import define from '../../../define';

export const meta = {
	desc: {
		'ja-JP': '自分の作成したユーザーリスト一覧を取得します。'
	},

	tags: ['lists', 'account'],

	requireCredential: true,

	kind: 'account-read',

	res: {
		type: 'array',
		items: {
			type: 'UserList',
		},
	},
};

export default define(meta, async (ps, me) => {
	const userLists = await UserList.find({
		userId: me.id,
	});

	return await Promise.all(userLists.map(x => pack(x)));
});
