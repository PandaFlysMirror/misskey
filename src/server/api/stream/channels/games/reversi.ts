import autobind from 'autobind-decorator';
import Matching, { pack } from '../../../../../models/games/reversi/matching';
import { publishMainStream } from '../../../../../services/stream';
import Channel from '../../channel';

export default class extends Channel {
	public readonly chName = 'gamesReversi';
	public static shouldShare = true;
	public static requireCredential = true;

	@autobind
	public async init(params: any) {
		// Subscribe reversi stream
		this.subscriber.on(`reversiStream:${this.user.id}`, data => {
			this.send(data);
		});
	}

	@autobind
	public async onMessage(type: string, body: any) {
		switch (type) {
			case 'ping':
				if (body.id == null) return;
				const matching = await Matching.findOne({
					parentId: this.user.id,
					childId: new mongo.ObjectID(body.id)
				});
				if (matching == null) return;
				publishMainStream(matching.childId, 'reversiInvited', await pack(matching, matching.childId));
				break;
		}
	}
}
