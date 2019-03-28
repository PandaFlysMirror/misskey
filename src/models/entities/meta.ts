import { Entity, Column, PrimaryColumn } from 'typeorm';
import { id } from '../id';

@Entity({
	orderBy: {
		id: 'DESC'
	}
})
export class Meta {
	@PrimaryColumn(id())
	public id: string;

	@Column('varchar', {
		length: 128, nullable: true
	})
	public name: string;

	@Column('varchar', {
		length: 1024, nullable: true
	})
	public description: string;

	/**
	 * メンテナの名前
	 */
	@Column('varchar', {
		length: 128, nullable: true
	})
	public maintainerName: string;

	/**
	 * メンテナの連絡先
	 */
	@Column('varchar', {
		length: 128, nullable: true
	})
	public maintainerEmail: string;

	@Column('jsonb', {
		default: [],
	})
	public announcements: Record<string, any>[];

	@Column('boolean', {
		default: false,
	})
	public disableRegistration: boolean;

	@Column('boolean', {
		default: false,
	})
	public disableLocalTimeline: boolean;

	@Column('boolean', {
		default: false,
	})
	public disableGlobalTimeline: boolean;

	@Column('boolean', {
		default: true,
	})
	public enableEmojiReaction: boolean;

	@Column('boolean', {
		default: false,
	})
	public useStarForReactionFallback: boolean;

	@Column('varchar', {
		length: 256, array: true, default: '{}'
	})
	public hiddenTags: string[];

	@Column('varchar', {
		length: 256,
		nullable: true,
		default: '/assets/ai.png'
	})
	public mascotImageUrl: string | null;

	@Column('varchar', {
		length: 256,
		nullable: true
	})
	public bannerUrl: string | null;

	@Column('varchar', {
		length: 256,
		nullable: true,
		default: 'https://ai.misskey.xyz/aiart/yubitun.png'
	})
	public errorImageUrl: string | null;

	@Column('varchar', {
		length: 256,
		nullable: true
	})
	public iconUrl: string | null;

	@Column('boolean', {
		default: true,
	})
	public cacheRemoteFiles: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public proxyAccount: string | null;

	@Column('boolean', {
		default: false,
	})
	public enableRecaptcha: boolean;

	@Column('varchar', {
		length: 64,
		nullable: true
	})
	public recaptchaSiteKey: string | null;

	@Column('varchar', {
		length: 64,
		nullable: true
	})
	public recaptchaSecretKey: string | null;

	@Column('integer', {
		default: 1024,
		comment: 'Drive capacity of a local user (MB)'
	})
	public localDriveCapacityMb: number;

	@Column('integer', {
		default: 32,
		comment: 'Drive capacity of a remote user (MB)'
	})
	public remoteDriveCapacityMb: number;

	@Column('integer', {
		default: 500,
		comment: 'Max allowed note text length in characters'
	})
	public maxNoteTextLength: number;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public summalyProxy: string | null;

	@Column('boolean', {
		default: false,
	})
	public enableEmail: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public email: string | null;

	@Column('boolean', {
		default: false,
	})
	public smtpSecure: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public smtpHost: string | null;

	@Column('integer', {
		nullable: true
	})
	public smtpPort: number | null;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public smtpUser: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public smtpPass: string | null;

	@Column('boolean', {
		default: false,
	})
	public enableServiceWorker: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public swPublicKey: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public swPrivateKey: string | null;

	@Column('boolean', {
		default: false,
	})
	public enableTwitterIntegration: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public twitterConsumerKey: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public twitterConsumerSecret: string | null;

	@Column('boolean', {
		default: false,
	})
	public enableGithubIntegration: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public githubClientId: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public githubClientSecret: string | null;

	@Column('boolean', {
		default: false,
	})
	public enableDiscordIntegration: boolean;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public discordClientId: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true
	})
	public discordClientSecret: string | null;
}
