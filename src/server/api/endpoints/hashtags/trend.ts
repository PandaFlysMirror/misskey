import define from '../../define';
import fetchMeta from '../../../../misc/fetch-meta';
import { Notes } from '../../../../models';
import { Note } from '../../../../models/entities/note';

/*
トレンドに載るためには「『直近a分間のユニーク投稿数が今からa分前～今からb分前の間のユニーク投稿数のn倍以上』のハッシュタグの上位5位以内に入る」ことが必要
ユニーク投稿数とはそのハッシュタグと投稿ユーザーのペアのカウントで、例えば同じユーザーが複数回同じハッシュタグを投稿してもそのハッシュタグのユニーク投稿数は1とカウントされる

..が理想だけどPostgreSQLでどうするのか分からないので単に「直近Aの内に投稿されたユニーク投稿数が多いハッシュタグ」で妥協する
*/

const rangeA = 1000 * 60 * 30; // 30分
//const rangeB = 1000 * 60 * 120; // 2時間
//const coefficient = 1.25; // 「n倍」の部分
//const requiredUsers = 3; // 最低何人がそのタグを投稿している必要があるか

const max = 5;

export const meta = {
	tags: ['hashtags'],

	requireCredential: false,
};

export default define(meta, async () => {
	const instance = await fetchMeta();
	const hiddenTags = instance.hiddenTags.map(t => t.toLowerCase());

	const tagNotes = await Notes.createQueryBuilder('note')
		.where(`note.createdAt > :date`, { date: new Date(Date.now() - rangeA) })
		.andWhere(`note.tags != '{}'`)
		.select(['note.tags', 'note.userId'])
		.getMany();

	if (tagNotes.length === 0) {
		return [];
	}

	const tags: {
		name: string;
		users: Note['userId'][];
	}[] = [];

	for (const note of tagNotes) {
		for (const tag of note.tags) {
			if (hiddenTags.includes(tag)) continue;

			const x = tags.find(x => x.name === tag);
			if (x) {
				if (!x.users.includes(note.userId)) {
					x.users.push(note.userId);
				}
			} else {
				tags.push({
					name: tag,
					users: [note.userId]
				});
			}
		}
	}

	// タグを人気順に並べ替え
	const hots = tags
		.sort((a, b) => b.users.length - a.users.length)
		.map(tag => tag.name)
		.slice(0, max);

	//#region 2(または3)で話題と判定されたタグそれぞれについて過去の投稿数グラフを取得する
	const countPromises: Promise<any[]>[] = [];

	const range = 20;

	// 10分
	const interval = 1000 * 60 * 10;

	for (let i = 0; i < range; i++) {
		countPromises.push(Promise.all(hots.map(tag => Notes.createQueryBuilder('note')
			.select('count(distinct note.userId)')
			.where(':tag = ANY(note.tags)', { tag: tag })
			.andWhere('note.createdAt < :lt', { lt: new Date(Date.now() - (interval * i)) })
			.andWhere('note.createdAt > :gt', { gt: new Date(Date.now() - (interval * (i + 1))) })
			.getRawOne()
			.then(x => parseInt(x.count, 10))
		)));
	}

	const countsLog = await Promise.all(countPromises);

	const totalCounts: any = await Promise.all(hots.map(tag => Notes.createQueryBuilder('note')
		.select('count(distinct note.userId)')
		.where(':tag = ANY(note.tags)', { tag: tag })
		.andWhere('note.createdAt > :gt', { gt: new Date(Date.now() - (interval * range)) })
		.getRawOne()
		.then(x => parseInt(x.count, 10))
	));
	//#endregion

	const stats = hots.map((tag, i) => ({
		tag,
		chart: countsLog.map(counts => counts[i].length),
		usersCount: totalCounts[i].length
	}));

	return stats;
});
