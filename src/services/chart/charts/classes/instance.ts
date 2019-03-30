import autobind from 'autobind-decorator';
import Chart, { Obj } from '../../core';
import { SchemaType } from '../../../../misc/schema';
import { DriveFiles, Followings, Users, Notes } from '../../../../models';
import { DriveFile } from '../../../../models/entities/drive-file';
import { name, schema } from '../schemas/instance';

type InstanceLog = SchemaType<typeof schema>;

export default class InstanceChart extends Chart<InstanceLog> {
	constructor() {
		super(name, schema);
	}

	@autobind
	protected async getTemplate(init: boolean, latest?: InstanceLog, group?: string): Promise<InstanceLog> {
		const [
			notesCount,
			usersCount,
			followingCount,
			followersCount,
			driveFiles,
			driveUsage,
		] = init ? await Promise.all([
			Notes.count({ userHost: group }),
			Users.count({ host: group }),
			Followings.count({ followerHost: group }),
			Followings.count({ followeeHost: group }),
			DriveFiles.count({ userHost: group }),
			DriveFiles.clacDriveUsageOfHost(group),
		]) : [
			latest ? latest.notes.total : 0,
			latest ? latest.users.total : 0,
			latest ? latest.following.total : 0,
			latest ? latest.followers.total : 0,
			latest ? latest.drive.totalFiles : 0,
			latest ? latest.drive.totalUsage : 0,
		];

		return {
			requests: {
				failed: 0,
				succeeded: 0,
				received: 0
			},
			notes: {
				total: notesCount,
				inc: 0,
				dec: 0
			},
			users: {
				total: usersCount,
				inc: 0,
				dec: 0
			},
			following: {
				total: followingCount,
				inc: 0,
				dec: 0
			},
			followers: {
				total: followersCount,
				inc: 0,
				dec: 0
			},
			drive: {
				totalFiles: driveFiles,
				totalUsage: driveUsage,
				incFiles: 0,
				incUsage: 0,
				decFiles: 0,
				decUsage: 0
			}
		};
	}

	@autobind
	public async requestReceived(host: string) {
		await this.inc({
			requests: {
				received: 1
			}
		}, host);
	}

	@autobind
	public async requestSent(host: string, isSucceeded: boolean) {
		const update: Obj = {};

		if (isSucceeded) {
			update.succeeded = 1;
		} else {
			update.failed = 1;
		}

		await this.inc({
			requests: update
		}, host);
	}

	@autobind
	public async newUser(host: string) {
		await this.inc({
			users: {
				total: 1,
				inc: 1
			}
		}, host);
	}

	@autobind
	public async updateNote(host: string, isAdditional: boolean) {
		await this.inc({
			notes: {
				total: isAdditional ? 1 : -1,
				inc: isAdditional ? 1 : 0,
				dec: isAdditional ? 0 : 1,
			}
		}, host);
	}

	@autobind
	public async updateFollowing(host: string, isAdditional: boolean) {
		await this.inc({
			following: {
				total: isAdditional ? 1 : -1,
				inc: isAdditional ? 1 : 0,
				dec: isAdditional ? 0 : 1,
			}
		}, host);
	}

	@autobind
	public async updateFollowers(host: string, isAdditional: boolean) {
		await this.inc({
			followers: {
				total: isAdditional ? 1 : -1,
				inc: isAdditional ? 1 : 0,
				dec: isAdditional ? 0 : 1,
			}
		}, host);
	}

	@autobind
	public async updateDrive(file: DriveFile, isAdditional: boolean) {
		const update: Obj = {};

		update.totalFiles = isAdditional ? 1 : -1;
		update.totalUsage = isAdditional ? file.size : -file.size;
		if (isAdditional) {
			update.incFiles = 1;
			update.incUsage = file.size;
		} else {
			update.decFiles = 1;
			update.decUsage = file.size;
		}

		await this.inc({
			drive: update
		}, file.userHost);
	}
}
