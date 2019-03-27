import * as Bull from 'bull';

import { queueLogger } from '../../logger';
import parseAcct from '../../../misc/acct/parse';
import resolveUser from '../../../remote/resolve-user';
import { pushUserToUserList } from '../../../services/user-list/push';
import { downloadTextFile } from '../../../misc/download-text-file';
import { isSelfHost, toDbHost } from '../../../misc/convert-host';
import { DriveFiles, Users, UserLists, UserListJoinings } from '../../../models';
import { genId } from '../../../misc/gen-id';

const logger = queueLogger.createSubLogger('import-user-lists');

export async function importUserLists(job: Bull.Job, done: any): Promise<void> {
	logger.info(`Importing user lists of ${job.data.user.id} ...`);

	const user = await Users.findOne({
		id: job.data.user.id
	});

	const file = await DriveFiles.findOne({
		id: job.data.fileId
	});

	const csv = await downloadTextFile(file.url);

	for (const line of csv.trim().split('\n')) {
		const listName = line.split(',')[0].trim();
		const { username, host } = parseAcct(line.split(',')[1].trim());

		let list = await UserLists.findOne({
			userId: user.id,
			name: listName
		});

		if (list == null) {
			list = await UserLists.save({
				id: genId(),
				createdAt: new Date(),
				userId: user.id,
				name: listName,
				userIds: []
			});
		}

		let target = isSelfHost(host) ? await Users.findOne({
			host: null,
			usernameLower: username.toLowerCase()
		}) : await Users.findOne({
			host: toDbHost(host),
			usernameLower: username.toLowerCase()
		});

		if (host == null && target == null) continue;

		if (await UserListJoinings.findOne({ userListId: list.id, userId: target.id }) != null) continue;

		if (target == null) {
			target = await resolveUser(username, host);
		}

		pushUserToUserList(target, list);
	}

	logger.succ('Imported');
	done();
}
