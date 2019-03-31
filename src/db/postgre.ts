import { createConnection, Logger, getConnection } from 'typeorm';
import config from '../config';
import { entities as charts } from '../services/chart/entities';
import { dbLogger } from './logger';
import * as highlight from 'cli-highlight';

import { Log } from '../models/entities/log';
import { User } from '../models/entities/user';
import { DriveFile } from '../models/entities/drive-file';
import { DriveFolder } from '../models/entities/drive-folder';
import { AccessToken } from '../models/entities/access-token';
import { App } from '../models/entities/app';
import { PollVote } from '../models/entities/poll-vote';
import { Note } from '../models/entities/note';
import { NoteReaction } from '../models/entities/note-reaction';
import { NoteWatching } from '../models/entities/note-watching';
import { NoteUnread } from '../models/entities/note-unread';
import { Notification } from '../models/entities/notification';
import { Meta } from '../models/entities/meta';
import { Following } from '../models/entities/following';
import { Instance } from '../models/entities/instance';
import { Muting } from '../models/entities/muting';
import { SwSubscription } from '../models/entities/sw-subscription';
import { Blocking } from '../models/entities/blocking';
import { UserList } from '../models/entities/user-list';
import { UserListJoining } from '../models/entities/user-list-joining';
import { Hashtag } from '../models/entities/hashtag';
import { NoteFavorite } from '../models/entities/note-favorite';
import { AbuseUserReport } from '../models/entities/abuse-user-report';
import { RegistrationTicket } from '../models/entities/registration-tickets';
import { MessagingMessage } from '../models/entities/messaging-message';
import { Signin } from '../models/entities/signin';
import { AuthSession } from '../models/entities/auth-session';
import { FollowRequest } from '../models/entities/follow-request';
import { Emoji } from '../models/entities/emoji';
import { ReversiGame } from '../models/entities/games/reversi/game';
import { ReversiMatching } from '../models/entities/games/reversi/matching';
import { UserNotePining } from '../models/entities/user-note-pinings';
import { UserServiceLinking } from '../models/entities/user-service-linking';
import { Poll } from '../models/entities/poll';
import { UserKeypair } from '../models/entities/user-keypair';
import { UserPublickey } from '../models/entities/user-publickey';

const sqlLogger = dbLogger.createSubLogger('sql', 'white', false);

class MyCustomLogger implements Logger {
	private highlight(sql: string) {
		return highlight.highlight(sql, {
			language: 'sql', ignoreIllegals: true,
		});
	}

	public logQuery(query: string, parameters?: any[]) {
		sqlLogger.info(this.highlight(query));
	}

	public logQueryError(error: string, query: string, parameters?: any[]) {
		sqlLogger.error(this.highlight(query));
	}

	public logQuerySlow(time: number, query: string, parameters?: any[]) {
		sqlLogger.warn(this.highlight(query));
	}

	public logSchemaBuild(message: string) {
		sqlLogger.info(message);
	}

	public log(message: string) {
		sqlLogger.info(message);
	}

	public logMigration(message: string) {
		sqlLogger.info(message);
	}
}

export function initDb(justBorrow = false) {
	try {
		const conn = getConnection();
		return Promise.resolve(conn);
	} catch (e) {}

	return createConnection({
		type: 'postgres',
		host: config.db.host,
		port: config.db.port,
		username: config.db.user,
		password: config.db.pass,
		database: config.db.db,
		synchronize: !justBorrow,
		dropSchema: process.env.NODE_ENV === 'test' && !justBorrow,
		logging: !['production', 'test'].includes(process.env.NODE_ENV),
		logger: new MyCustomLogger(),
		entities: [
			Meta,
			Instance,
			App,
			AuthSession,
			AccessToken,
			User,
			UserKeypair,
			UserPublickey,
			UserList,
			UserListJoining,
			UserNotePining,
			UserServiceLinking,
			Following,
			FollowRequest,
			Muting,
			Blocking,
			Note,
			NoteFavorite,
			NoteReaction,
			NoteWatching,
			NoteUnread,
			Log,
			DriveFile,
			DriveFolder,
			Poll,
			PollVote,
			Notification,
			Emoji,
			Hashtag,
			SwSubscription,
			AbuseUserReport,
			RegistrationTicket,
			MessagingMessage,
			Signin,
			ReversiGame,
			ReversiMatching,
			...charts as any
		]
	});
}
