const Log = db.get<ILog>('logs');
Log.createIndex('createdAt', { expireAfterSeconds: 3600 * 24 * 3 });
Log.createIndex('level');
Log.createIndex('domain');
export default Log;

export interface ILog {
	_id: mongo.ObjectID;
	createdAt: Date;
	machine: string;
	worker: string;
	domain: string[];
	level: string;
	message: string;
	data: any;
}
