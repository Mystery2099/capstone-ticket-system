import { requireUser } from '$lib/server/access';
import { loadInbox, markNotificationsRead } from '$lib/server/notifications';
import type { Actions, PageServerLoad } from './$types';

/** Unread notifications by default; `?show=all` includes the ones already read. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const isUnreadOnly = url.searchParams.get('show') !== 'all';
	return {
		notifications: await loadInbox(requireUser(locals.user), isUnreadOnly),
		isUnreadOnly
	};
};

export const actions: Actions = {
	markRead: async ({ locals, request }) => {
		const notificationId = String((await request.formData()).get('notificationId') ?? '');
		// Anything but a single id would mark every notification, so an empty id does nothing.
		if (notificationId) await markNotificationsRead(requireUser(locals.user), notificationId);
	},
	markAllRead: async ({ locals }) => {
		await markNotificationsRead(requireUser(locals.user));
	}
};
