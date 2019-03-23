import autobind from 'autobind-decorator';
import Mute from '../../../../models/entities/muting';
import { pack } from '../../../../models/entities/note';
import shouldMuteThisNote from '../../../../misc/should-mute-this-note';
import Channel from '../channel';

export default class extends Channel {
	public readonly chName = 'homeTimeline';
	public static shouldShare = true;
	public static requireCredential = true;

	private mutedUserIds: string[] = [];

	@autobind
	public async init(params: any) {
		// Subscribe events
		this.subscriber.on(`homeTimeline:${this.user.id}`, this.onNote);

		const mute = await Mute.find({ muterId: this.user.id });
		this.mutedUserIds = mute.map(m => m.muteeId.toString());
	}

	@autobind
	private async onNote(note: any) {
		// リプライなら再pack
		if (note.replyId != null) {
			note.reply = await pack(note.replyId, this.user, {
				detail: true
			});
		}
		// Renoteなら再pack
		if (note.renoteId != null) {
			note.renote = await pack(note.renoteId, this.user, {
				detail: true
			});
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (shouldMuteThisNote(note, this.mutedUserIds)) return;

		this.send('note', note);
	}

	@autobind
	public dispose() {
		// Unsubscribe events
		this.subscriber.off(`homeTimeline:${this.user.id}`, this.onNote);
	}
}
