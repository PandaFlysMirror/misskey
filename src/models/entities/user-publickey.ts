import { PrimaryColumn, Entity, Index, JoinColumn, Column, OneToOne } from 'typeorm';
import { User } from './user';
import { id } from '../id';

@Entity({
	orderBy: {
		id: 'DESC'
	}
})
export class UserPublickey {
	@PrimaryColumn(id())
	public id: string;

	@Index({ unique: true })
	@Column(id())
	public userId: User['id'];

	@OneToOne(type => User, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public user: User | null;

	@Index({ unique: true })
	@Column('varchar', {
		length: 256,
	})
	public keyId: string;

	@Column('varchar', {
		length: 2048,
	})
	public keyPem: string;
}
