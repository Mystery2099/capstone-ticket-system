import { requireUser } from '$lib/server/access';
import { INBOX_PAGE_SIZE, loadInbox, markNotificationsRead } from '$lib/server/notifications';
import type { Actions, PageServerLoad } from './$types';

/**
 * Unread notifications by default; `?show=all` includes the ones already read. `?before=`
 * continues from an earlier page.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const isUnreadOnly = url.searchParams.get('show') !== 'all';
	const olderThanCursor = url.searchParams.get('before') ?? undefined;
	const notifications = await loadInbox(requireUser(locals.user), isUnreadOnly, olderThanCursor);
	let olderPageHref: string | null = null;
	if (notifications.length === INBOX_PAGE_SIZE) {
		const olderPageParams = new URLSearchParams();
		if (!isUnreadOnly) olderPageParams.set('show', 'all');
		olderPageParams.set('before', notifications[notifications.length - 1].pageCursor);
		olderPageHref = `/app/inbox?${olderPageParams}`;
	}
	return {
		notifications,
		isUnreadOnly,
		isFirstPage: !olderThanCursor,
		olderPageHref
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
