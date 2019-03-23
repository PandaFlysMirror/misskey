import Following from '../../../models/entities/following';

export const getFriendIds = async (me: mongodb.ObjectID, includeMe = true) => {
	// Fetch relation to other users who the I follows
	// SELECT followee
	const followings = await Following
		.find({
			followerId: me
		}, {
			fields: {
				followeeId: true
			}
		});

	// ID list of other users who the I follows
	const myfollowingIds = followings.map(following => following.followeeId);

	if (includeMe) {
		myfollowingIds.push(me);
	}

	return myfollowingIds;
};

export const getFriends = async (me: mongodb.ObjectID, includeMe = true, remoteOnly = false) => {
	const q: any = remoteOnly ? {
		followerId: me,
		'_followee.host': { $ne: null }
	} : {
		followerId: me
	};
	// Fetch relation to other users who the I follows
	const followings = await Following
		.find(q);

	// ID list of other users who the I follows
	const myfollowings = followings.map(following => ({
		id: following.followeeId
	}));

	if (includeMe) {
		myfollowings.push({
			id: me
		});
	}

	return myfollowings;
};
