import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import define from '../../define';
import { makePaginationQuery } from '../../common/make-pagination-query';
import { Notes, Followings } from '../../../../models';
import { generateVisibilityQuery } from '../../common/generate-visibility-query';
import { generateMuteQuery } from '../../common/generate-mute-query';
import { activeUsersChart } from '../../../../services/chart';
import { Brackets } from 'typeorm';

export const meta = {
	desc: {
		'ja-JP': 'タイムラインを取得します。',
		'en-US': 'Get timeline of myself.'
	},

	tags: ['notes'],

	requireCredential: true,

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10,
			desc: {
				'ja-JP': '最大数'
			}
		},

		sinceId: {
			validator: $.optional.type(ID),
			desc: {
				'ja-JP': '指定すると、その投稿を基点としてより新しい投稿を取得します'
			}
		},

		untilId: {
			validator: $.optional.type(ID),
			desc: {
				'ja-JP': '指定すると、その投稿を基点としてより古い投稿を取得します'
			}
		},

		sinceDate: {
			validator: $.optional.num,
			desc: {
				'ja-JP': '指定した時間を基点としてより新しい投稿を取得します。数値は、1970年1月1日 00:00:00 UTC から指定した日時までの経過時間をミリ秒単位で表します。'
			}
		},

		untilDate: {
			validator: $.optional.num,
			desc: {
				'ja-JP': '指定した時間を基点としてより古い投稿を取得します。数値は、1970年1月1日 00:00:00 UTC から指定した日時までの経過時間をミリ秒単位で表します。'
			}
		},

		includeMyRenotes: {
			validator: $.optional.bool,
			default: true,
			desc: {
				'ja-JP': '自分の行ったRenoteを含めるかどうか'
			}
		},

		includeRenotedMyNotes: {
			validator: $.optional.bool,
			default: true,
			desc: {
				'ja-JP': 'Renoteされた自分の投稿を含めるかどうか'
			}
		},

		includeLocalRenotes: {
			validator: $.optional.bool,
			default: true,
			desc: {
				'ja-JP': 'Renoteされたローカルの投稿を含めるかどうか'
			}
		},

		withFiles: {
			validator: $.optional.bool,
			desc: {
				'ja-JP': 'true にすると、ファイルが添付された投稿だけ取得します'
			}
		},
	},

	res: {
		type: 'array',
		items: {
			type: 'Note',
		},
	},
};

export default define(meta, async (ps, user) => {
	//#region Construct query
	const followingQuery = Followings.createQueryBuilder('following')
		.select('following.followeeId')
		.where('following.followerId = :followerId', { followerId: user.id });

	const query = makePaginationQuery(Notes.createQueryBuilder('note'),
			ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
		.andWhere(new Brackets(qb => { qb
			.where(`note.userId IN (${ followingQuery.getQuery() })`)
			.orWhere('note.userId = :meId', { meId: user.id });
		}))
		.leftJoinAndSelect('note.user', 'user')
		.setParameters(followingQuery.getParameters());

	generateVisibilityQuery(query, user);
	generateMuteQuery(query, user);

	/* v11 TODO
	// MongoDBではトップレベルで否定ができないため、De Morganの法則を利用してクエリします。
	// つまり、「『自分の投稿かつRenote』ではない」を「『自分の投稿ではない』または『Renoteではない』」と表現します。
	// for details: https://en.wikipedia.org/wiki/De_Morgan%27s_laws

	if (ps.includeMyRenotes === false) {
		query.$and.push({
			$or: [{
				userId: { $ne: user.id }
			}, {
				renoteId: null
			}, {
				text: { $ne: null }
			}, {
				fileIds: { $ne: [] }
			}, {
				poll: { $ne: null }
			}]
		});
	}

	if (ps.includeRenotedMyNotes === false) {
		query.$and.push({
			$or: [{
				'_renote.userId': { $ne: user.id }
			}, {
				renoteId: null
			}, {
				text: { $ne: null }
			}, {
				fileIds: { $ne: [] }
			}, {
				poll: { $ne: null }
			}]
		});
	}

	if (ps.includeLocalRenotes === false) {
		query.$and.push({
			$or: [{
				'_renote.user.host': { $ne: null }
			}, {
				renoteId: null
			}, {
				text: { $ne: null }
			}, {
				fileIds: { $ne: [] }
			}, {
				poll: { $ne: null }
			}]
		});
	}*/

	if (ps.withFiles) {
		query.andWhere('note.fileIds != \'{}\'');
	}
	//#endregion

	const timeline = await query.take(ps.limit).getMany();

	activeUsersChart.update(user);

	return await Notes.packMany(timeline, user);
});
