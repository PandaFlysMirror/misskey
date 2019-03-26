import { publishNoteStream } from '../../stream';
import notify from '../../create-notification';
import watch from '../watch';
import renderLike from '../../../remote/activitypub/renderer/like';
import { deliver } from '../../../queue';
import { renderActivity } from '../../../remote/activitypub/renderer';
import { IdentifiableError } from '../../../misc/identifiable-error';
import { toDbReaction } from '../../../misc/reaction-lib';
import fetchMeta from '../../../misc/fetch-meta';
import { User } from '../../../models/entities/user';
import { Note } from '../../../models/entities/note';
import { NoteReactions, Users, NoteWatchings, Notes } from '../../../models';
import { Not } from 'typeorm';
import { perUserReactionsChart } from '../../chart';

export default async (user: User, note: Note, reaction: string) => {
	// Myself
	if (note.userId === user.id) {
		throw new IdentifiableError('2d8e7297-1873-4c00-8404-792c68d7bef0', 'cannot react to my note');
	}

	const meta = await fetchMeta();
	reaction = await toDbReaction(reaction, meta.enableEmojiReaction);

	// Create reaction
	await NoteReactions.save({
		createdAt: new Date(),
		noteId: note.id,
		userId: user.id,
		reaction
	}).catch(e => {
		// duplicate key error
		if (e.code === 11000) {
			throw new IdentifiableError('51c42bb4-931a-456b-bff7-e5a8a70dd298', 'already reacted');
		}

		throw e;
	});

	// Increment reactions count
	const sql = `jsonb_set("reactions", '{${reaction}}', (COALESCE("reactions"->>'${reaction}', '0')::int + 1)::text::jsonb)`;
	await Notes.createQueryBuilder().update()
		.set({
			reactions: () => sql,
		})
		.where('id = :id', { id: note.id })
		.execute();
	// v11 inc score

	perUserReactionsChart.update(user, note);

	publishNoteStream(note.id, 'reacted', {
		reaction: reaction,
		userId: user.id
	});

	// リアクションされたユーザーがローカルユーザーなら通知を作成
	if (note.userHost === null) {
		notify(note.userId, user.id, 'reaction', {
			noteId: note.id,
			reaction: reaction
		});
	}

	// Fetch watchers
	NoteWatchings.find({
		noteId: note.id,
		userId: Not(user.id)
	}).then(watchers => {
		for (const watcher of watchers) {
			notify(watcher.userId, user.id, 'reaction', {
				noteId: note.id,
				reaction: reaction
			});
		}
	});

	// ユーザーがローカルユーザーかつ自動ウォッチ設定がオンならばこの投稿をWatchする
	if (Users.isLocalUser(user) && user.autoWatch !== false) {
		watch(user.id, note);
	}

	//#region 配信
	// リアクターがローカルユーザーかつリアクション対象がリモートユーザーの投稿なら配送
	if (Users.isLocalUser(user) && note.userHost !== null) {
		const content = renderActivity(renderLike(user, note, reaction));
		deliver(user, content, note.userInbox);
	}
	//#endregion
};
