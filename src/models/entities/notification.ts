import { Entity, Index, JoinColumn, ManyToOne, Column, PrimaryColumn } from 'typeorm';
import { User } from './user';
import { id } from '../id';
import { Note } from './note';

@Entity()
export class Notification {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the Notification.'
	})
	public createdAt: Date;

	/**
	 * 通知の受信者
	 */
	@Index()
	@Column({
		...id(),
		comment: 'The ID of recipient user of the Notification.'
	})
	public notifieeId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public notifiee: User | null;

	/**
	 * 通知の送信者(initiator)
	 */
	@Column({
		...id(),
		comment: 'The ID of sender user of the Notification.'
	})
	public notifierId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public notifier: User | null;

	/**
	 * 通知の種類。
	 * follow - フォローされた
	 * mention - 投稿で自分が言及された
	 * reply - (自分または自分がWatchしている)投稿が返信された
	 * renote - (自分または自分がWatchしている)投稿がRenoteされた
	 * quote - (自分または自分がWatchしている)投稿が引用Renoteされた
	 * reaction - (自分または自分がWatchしている)投稿にリアクションされた
	 * pollVote - (自分または自分がWatchしている)投稿の投票に投票された
	 */
	@Column('varchar', {
		length: 32,
		comment: 'The type of the Notification.'
	})
	public type: string;

	/**
	 * 通知が読まれたかどうか
	 */
	@Column('boolean', {
		default: false,
		comment: 'Whether the Notification is read.'
	})
	public isRead: boolean;

	@Column({
		...id(),
		nullable: true
	})
	public noteId: Note['id'] | null;

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public note: Note | null;

	@Column('varchar', {
		length: 128, nullable: true
	})
	public reaction: string;

	@Column('integer', {
		nullable: true
	})
	public choice: number;
}
