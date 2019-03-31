import $ from 'cafy';
import { ID } from '../../../../misc/cafy-id';
import define from '../../define';
import { ApiError } from '../../error';
import { getUser } from '../../common/getters';
import { makePaginationQuery } from '../../common/make-pagination-query';
import { generateVisibilityQuery } from '../../common/generate-visibility-query';
import { Notes } from '../../../../models';
import { generateMuteQuery } from '../../common/generate-mute-query';

export const meta = {
	desc: {
		'ja-JP': '指定したユーザーのタイムラインを取得します。'
	},

	tags: ['users', 'notes'],

	params: {
		userId: {
			validator: $.type(ID),
			desc: {
				'ja-JP': '対象のユーザーのID',
				'en-US': 'Target user ID'
			}
		},

		includeReplies: {
			validator: $.optional.bool,
			default: true,

			desc: {
				'ja-JP': 'リプライを含めるか否か'
			}
		},

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
			default: false,
			desc: {
				'ja-JP': 'true にすると、ファイルが添付された投稿だけ取得します'
			}
		},

		fileType: {
			validator: $.optional.arr($.str),
			desc: {
				'ja-JP': '指定された種類のファイルが添付された投稿のみを取得します'
			}
		},

		excludeNsfw: {
			validator: $.optional.bool,
			default: false,
			desc: {
				'ja-JP': 'true にすると、NSFW指定されたファイルを除外します(fileTypeが指定されている場合のみ有効)'
			}
		},
	},

	res: {
		type: 'array',
		items: {
			type: 'Note',
		},
	},

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '27e494ba-2ac2-48e8-893b-10d4d8c2387b'
		}
	}
};

export default define(meta, async (ps, me) => {
	// Lookup user
	const user = await getUser(ps.userId).catch(e => {
		if (e.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	//#region Construct query
	const query = makePaginationQuery(Notes.createQueryBuilder('note'), ps.sinceId, ps.untilId)
		.andWhere('note.userId = :userId', { userId: user.id })
		.leftJoinAndSelect('note.user', 'user');

	if (me) generateVisibilityQuery(query, me);
	if (me) generateMuteQuery(query, me);

	if (ps.withFiles) {
		query.andWhere('note.fileIds != \'{}\'');
	}

	if (ps.fileType) {
		query.andWhere('note.fileIds != \'{}\'');
		query.andWhere('note.attachedFileTypes ANY(:type)', { type: ps.fileType });

		if (ps.excludeNsfw) {
			// v11 TODO
			query['_files.isSensitive'] = {
				$ne: true
			};
		}
	}

	if (!ps.includeReplies) {
		query.andWhere('note.replyId IS NULL');
	}

	/* TODO
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
	*/

	//#endregion

	const timeline = await query.take(ps.limit).getMany();

	return await Notes.packMany(timeline, user);
});
