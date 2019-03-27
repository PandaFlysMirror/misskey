import * as Koa from 'koa';
import * as bcrypt from 'bcryptjs';
import { generate as generateKeypair } from '../../../crypto_key';
import generateUserToken from '../common/generate-native-user-token';
import config from '../../../config';
import fetchMeta from '../../../misc/fetch-meta';
import * as recaptcha from 'recaptcha-promise';
import { Users, RegistrationTickets, UserServiceLinkings } from '../../../models';
import { genId } from '../../../misc/gen-id';
import { usersChart } from '../../../services/chart';
import { UserServiceLinking } from '../../../models/entities/user-service-linking';
import { User } from '../../../models/entities/user';

export default async (ctx: Koa.BaseContext) => {
	const body = ctx.request.body as any;

	const instance = await fetchMeta();

	// Verify recaptcha
	// ただしテスト時はこの機構は障害となるため無効にする
	if (process.env.NODE_ENV !== 'test' && instance.enableRecaptcha) {
		recaptcha.init({
			secret_key: instance.recaptchaSecretKey
		});

		const success = await recaptcha(body['g-recaptcha-response']);

		if (!success) {
			ctx.throw(400, 'recaptcha-failed');
			return;
		}
	}

	const username = body['username'];
	const password = body['password'];
	const invitationCode = body['invitationCode'];

	if (instance && instance.disableRegistration) {
		if (invitationCode == null || typeof invitationCode != 'string') {
			ctx.status = 400;
			return;
		}

		const ticket = await RegistrationTickets.findOne({
			code: invitationCode
		});

		if (ticket == null) {
			ctx.status = 400;
			return;
		}

		RegistrationTickets.delete(ticket.id);
	}

	// Validate username
	if (!Users.validateUsername(username)) {
		ctx.status = 400;
		return;
	}

	// Validate password
	if (!Users.validatePassword(password)) {
		ctx.status = 400;
		return;
	}

	const usersCount = await Users.count({});

	// Generate hash of password
	const salt = await bcrypt.genSalt(8);
	const hash = await bcrypt.hash(password, salt);

	// Generate secret
	const secret = generateUserToken();

	const account = await Users.save({
		id: genId(),
		createdAt: new Date(),
		username: username,
		usernameLower: username.toLowerCase(),
		keypair: generateKeypair(),
		token: secret,
		password: hash,
		isAdmin: config.autoAdmin && usersCount === 0,
		autoAcceptFollowed: true,
		autoWatch: false
	} as User);

	await UserServiceLinkings.save({
		id: genId(),
		userId: account.id
	} as UserServiceLinking);

	usersChart.update(account, true);

	const res = await Users.pack(account, account, {
		detail: true,
		includeSecrets: true
	});

	res.token = secret;

	ctx.body = res;
};
