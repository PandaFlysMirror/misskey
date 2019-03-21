const RegistrationTicket = db.get<IRegistrationTicket>('registrationTickets');
RegistrationTicket.createIndex('code', { unique: true });
export default RegistrationTicket;

export interface IRegistrationTicket {
	_id: mongo.ObjectID;
	createdAt: Date;
	code: string;
}
