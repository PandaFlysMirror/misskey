import Note, { Note } from '../../models/note';
import { User, isLocalUser, isRemoteUser } from '../../models/user';
import { publishNoteStream } from '../stream';
import renderDelete from '../../remote/activitypub/renderer/delete';
import { renderActivity } from '../../remote/activitypub/renderer';
import { deliver } from '../../queue';
import Following from '../../models/following';
import renderTombstone from '../../remote/activitypub/renderer/tombstone';
import notesChart from '../chart/charts/notes';
import perUserNotesChart from '../chart/charts/per-user-notes';
import config from '../../config';
import NoteUnread from '../../models/note-unread';
import read from './read';
import DriveFile from '../../models/drive-file';
import { registerOrFetchInstanceDoc } from '../register-or-fetch-instance-doc';
import Instance from '../../models/instance';
import instanceChart from '../chart/charts/instance';
import Favorite from '../../models/note-favorite';

/**
 * 投稿を削除します。
 * @param user 投稿者
 * @param note 投稿
 */
export default async function(user: User, note: Note, quiet = false) {
	const deletedAt = new Date();

	await Note.update({
		id: note.id,
		userId: user.id
	}, {
		$set: {
			deletedAt: deletedAt,
			text: null,
			tags: [],
			fileIds: [],
			renoteId: null,
			poll: null,
			geo: null,
			cw: null
		}
	});

	if (note.renoteId) {
		Note.update({ _id: note.renoteId }, {
			$inc: {
				renoteCount: -1,
				score: -1
			},
			$pull: {
				_quoteIds: note.id
			}
		});
	}

	// この投稿が関わる未読通知を削除
	NoteUnread.find({
		noteId: note.id
	}).then(unreads => {
		for (const unread of unreads) {
			read(unread.userId, unread.noteId);
		}
	});

	// この投稿をお気に入りから削除
	Favorite.remove({
		noteId: note.id
	});

	// ファイルが添付されていた場合ドライブのファイルの「このファイルが添付された投稿一覧」プロパティからこの投稿を削除
	if (note.fileIds) {
		for (const fileId of note.fileIds) {
			DriveFile.update({ _id: fileId }, {
				$pull: {
					'metadata.attachedNoteIds': note.id
				}
			});
		}
	}

	if (!quiet) {
		publishNoteStream(note.id, 'deleted', {
			deletedAt: deletedAt
		});

		//#region ローカルの投稿なら削除アクティビティを配送
		if (isLocalUser(user)) {
			const content = renderActivity(renderDelete(renderTombstone(`${config.url}/notes/${note.id}`), user));

			const followings = await Following.find({
				followeeId: user.id,
				'_follower.host': { $ne: null }
			});

			for (const following of followings) {
				deliver(user, content, following._follower.inbox);
			}
		}
		//#endregion

		// 統計を更新
		notesChart.update(note, false);
		perUserNotesChart.update(user, note, false);

		if (isRemoteUser(user)) {
			registerOrFetchInstanceDoc(user.host).then(i => {
				Instance.update({ _id: i.id }, {
					$inc: {
						notesCount: -1
					}
				});

				instanceChart.updateNote(i.host, false);
			});
		}
	}
}
