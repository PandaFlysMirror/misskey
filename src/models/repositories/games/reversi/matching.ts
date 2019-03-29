import { EntityRepository, Repository } from 'typeorm';
import rap from '@prezzemolo/rap';
import { ReversiMatching } from '../../../entities/games/reversi/matching';
import { Users } from '../../..';

@EntityRepository(ReversiMatching)
export class ReversiMatchingRepository extends Repository<ReversiMatching> {
	public async pack(
		src: ReversiMatching['id'] | ReversiMatching,
		me: any
	) {
		const matching = typeof src === 'object' ? src : await this.findOne(src);

		return await rap({
			id: matching.id,
			parent: Users.pack(matching.parentId, me, {
				detail: true
			}),
			child: Users.pack(matching.childId, me, {
				detail: true
			})
		});
	}
}
