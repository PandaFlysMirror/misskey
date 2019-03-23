import $ from 'cafy';
import define from '../../../define';
import { detectUrlMine } from '../../../../../misc/detect-url-mine';
import { StringID } from '../../../../../misc/cafy-id';
import { Emojis } from '../../../../../models';

export const meta = {
	desc: {
		'ja-JP': 'カスタム絵文字を更新します。'
	},

	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	params: {
		id: {
			validator: $.type(StringID)
		},

		name: {
			validator: $.str
		},

		url: {
			validator: $.str
		},

		aliases: {
			validator: $.arr($.str)
		}
	}
};

export default define(meta, async (ps) => {
	const emoji = await Emojis.findOne(ps.id);

	if (emoji == null) throw new Error('emoji not found');

	const type = await detectUrlMine(ps.url);

	await Emojis.update(emoji.id, {
		updatedAt: new Date(),
		name: ps.name,
		aliases: ps.aliases,
		url: ps.url,
		type,
	});
});
