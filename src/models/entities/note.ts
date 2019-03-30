import { Entity, Index, JoinColumn, Column, PrimaryColumn, ManyToOne } from 'typeorm';
import { User } from './user';
import { App } from './app';
import { DriveFile } from './drive-file';
import { id } from '../id';

@Entity()
export class Note {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the Note.'
	})
	public createdAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The updated date of the Note.'
	})
	public updatedAt: Date | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of reply target.'
	})
	public replyId: Note['id'] | null;

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public reply: Note | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of renote target.'
	})
	public renoteId: Note['id'] | null;

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public renote: Note | null;

	@Column({
		type: 'text', nullable: true
	})
	public text: string | null;

	@Column('varchar', {
		length: 256, nullable: true
	})
	public name: string | null;

	@Column('varchar', {
		length: 512, nullable: true
	})
	public cw: string | null;

	@Column({
		...id(),
		nullable: true
	})
	public appId: App['id'] | null;

	@ManyToOne(type => App, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	public app: App | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of author.'
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public user: User | null;

	@Column('boolean', {
		default: false
	})
	public viaMobile: boolean;

	@Column('boolean', {
		default: false
	})
	public localOnly: boolean;

	@Column('integer', {
		default: 0
	})
	public renoteCount: number;

	@Column('integer', {
		default: 0
	})
	public repliesCount: number;

	@Column('jsonb', {
		default: {}
	})
	public reactions: Record<string, number>;

	/**
	 * public ... 公開
	 * home ... ホームタイムライン(ユーザーページのタイムライン含む)のみに流す
	 * followers ... フォロワーのみ
	 * specified ... visibleUserIds で指定したユーザーのみ
	 */
	@Column('enum', { enum: ['public', 'home', 'followers', 'specified'] })
	public visibility: 'public' | 'home' | 'followers' | 'specified';

	@Index({ unique: true })
	@Column('varchar', {
		length: 256, nullable: true,
		comment: 'The URI of a note. it will be null when the note is local.'
	})
	public uri: string | null;

	@Column('integer', {
		default: 0
	})
	public score: number;

	@Column({
		...id(),
		array: true, default: '{}'
	})
	public fileIds: DriveFile['id'][];

	@Column('varchar', {
		length: 256, array: true, default: '{}'
	})
	public attachedFileTypes: string[];

	@Index()
	@Column({
		...id(),
		array: true, default: '{}'
	})
	public visibleUserIds: User['id'][];

	@Index()
	@Column({
		...id(),
		array: true, default: '{}'
	})
	public mentions: User['id'][];

	@Column('text', {
		default: '[]'
	})
	public mentionedRemoteUsers: string;

	@Column('varchar', {
		length: 128, array: true, default: '{}'
	})
	public emojis: string[];

	@Index()
	@Column('varchar', {
		length: 128, array: true, default: '{}'
	})
	public tags: string[];

	@Column('boolean', {
		default: false
	})
	public hasPoll: boolean;

	@Column('jsonb', {
		nullable: true, default: {}
	})
	public geo: any | null;

	//#region Denormalized fields
	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]'
	})
	public userHost: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]'
	})
	public userInbox: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: '[Denormalized]'
	})
	public replyUserId: User['id'] | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]'
	})
	public replyUserHost: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: '[Denormalized]'
	})
	public renoteUserId: User['id'] | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]'
	})
	public renoteUserHost: string | null;
	//#endregion
}

export type IMentionedRemoteUsers = {
	uri: string;
	username: string;
	host: string;
}[];
