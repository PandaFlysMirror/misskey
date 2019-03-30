import $ from 'cafy';
import { publishMainStream } from '../../../../services/stream';
import define from '../../define';
import * as nodemailer from 'nodemailer';
import fetchMeta from '../../../../misc/fetch-meta';
import rndstr from 'rndstr';
import config from '../../../../config';
import * as ms from 'ms';
import * as bcrypt from 'bcryptjs';
import { apiLogger } from '../../logger';
import { Users } from '../../../../models';

export const meta = {
	requireCredential: true,

	secure: true,

	limit: {
		duration: ms('1hour'),
		max: 3
	},

	params: {
		password: {
			validator: $.str
		},

		email: {
			validator: $.optional.nullable.str
		},
	}
};

export default define(meta, async (ps, user) => {
	// Compare password
	const same = await bcrypt.compare(ps.password, user.password);

	if (!same) {
		throw new Error('incorrect password');
	}

	await Users.update(user.id, {
		email: ps.email,
		emailVerified: false,
		emailVerifyCode: null
	});

	const iObj = await Users.pack(user.id, user, {
		detail: true,
		includeSecrets: true
	});

	// Publish meUpdated event
	publishMainStream(user.id, 'meUpdated', iObj);

	if (ps.email != null) {
		const code = rndstr('a-z0-9', 16);

		await Users.update(user.id, {
			emailVerifyCode: code
		});

		const meta = await fetchMeta();

		const enableAuth = meta.smtpUser != null && meta.smtpUser !== '';

		const transporter = nodemailer.createTransport({
			host: meta.smtpHost,
			port: meta.smtpPort,
			secure: meta.smtpSecure,
			ignoreTLS: !enableAuth,
			auth: enableAuth ? {
				user: meta.smtpUser,
				pass: meta.smtpPass
			} : undefined
		});

		const link = `${config.url}/verify-email/${code}`;

		transporter.sendMail({
			from: meta.email,
			to: ps.email,
			subject: meta.name || 'Misskey',
			text: `To verify email, please click this link: ${link}`
		}, (error, info) => {
			if (error) {
				apiLogger.error(error);
				return;
			}

			apiLogger.info('Message sent: %s', info.messageId);
		});
	}

	return iObj;
});
