import config from '../../../../config';
import { IBlock } from '../../type';
import block from '../../../../services/blocking/create';
import { apLogger } from '../../logger';
import { Users } from '../../../../models';
import { IRemoteUser } from '../../../../models/entities/user';

const logger = apLogger;

export default async (actor: IRemoteUser, activity: IBlock): Promise<void> => {
	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;

	const uri = activity.id || activity;

	logger.info(`Block: ${uri}`);

	if (!id.startsWith(config.url + '/')) {
		return null;
	}

	const blockee = await Users.findOne(id.split('/').pop());

	if (blockee == null) {
		throw new Error('blockee not found');
	}

	if (blockee.host != null) {
		throw new Error('ブロックしようとしているユーザーはローカルユーザーではありません');
	}

	block(actor, blockee);
};
