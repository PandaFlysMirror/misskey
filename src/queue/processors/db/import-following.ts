import * as Bull from 'bull';

import { queueLogger } from '../../logger';
import follow from '../../../services/following/create';
import parseAcct from '../../../misc/acct/parse';
import resolveUser from '../../../remote/resolve-user';
import { downloadTextFile } from '../../../misc/download-text-file';
import { isSelfHost, toDbHost } from '../../../misc/convert-host';
import { Users, DriveFiles } from '../../../models';

const logger = queueLogger.createSubLogger('import-following');

export async function importFollowing(job: Bull.Job, done: any): Promise<void> {
	logger.info(`Importing following of ${job.data.user.id} ...`);

	const user = await Users.findOne({
		id: job.data.user.id
	});

	const file = await DriveFiles.findOne({
		id: job.data.fileId
	});

	const csv = await downloadTextFile(file.url);

	for (const line of csv.trim().split('\n')) {
		const { username, host } = parseAcct(line.trim());

		let target = isSelfHost(host) ? await Users.findOne({
			host: null,
			usernameLower: username.toLowerCase()
		}) : await Users.findOne({
			host: toDbHost(host),
			usernameLower: username.toLowerCase()
		});

		if (host == null && target == null) continue;

		if (target == null) {
			target = await resolveUser(username, host);
		}

		logger.info(`Follow ${target.id} ...`);

		follow(user, target);
	}

	logger.succ('Imported');
	done();
}
