import { Context } from 'cafy';

export const isAnId = (x: any) => mongo.ObjectID.isValid(x);
export const isNotAnId = (x: any) => !isAnId(x);
export const transform = (x: string | mongo.ObjectID): mongo.ObjectID => {
	if (x === undefined) return undefined;
	if (x === null) return null;

	if (isAnId(x) && !isObjectId(x)) {
		return new mongo.ObjectID(x);
	} else {
		return x as mongo.ObjectID;
	}
};
export const transformMany = (xs: (string | mongo.ObjectID)[]): mongo.ObjectID[] => {
	if (xs == null) return null;

	return xs.map(x => transform(x));
};

export type ObjectId = mongo.ObjectID;

/**
 * ID
 */
export default class ID<Maybe = string> extends Context<string | Maybe> {
	public readonly name = 'ID';

	constructor(optional = false, nullable = false) {
		super(optional, nullable);

		this.push((v: any) => {
			if (!isObjectId(v) && isNotAnId(v)) {
				return new Error('must-be-an-id');
			}
			return true;
		});
	}

	public getType() {
		return super.getType('String');
	}

	public makeOptional(): ID<undefined> {
		return new ID(true, false);
	}

	public makeNullable(): ID<null> {
		return new ID(false, true);
	}

	public makeOptionalNullable(): ID<undefined | null> {
		return new ID(true, true);
	}
}
