import { building } from '$app/environment';
import { initialize } from '$lib/server/init';
import { db } from '$lib/server/db';
import { user } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import type { Handle } from '@sveltejs/kit';
export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	await initialize();
	const { auth } = await import('$lib/server/auth');
	if (event.url.pathname.startsWith('/api/auth/')) return auth.handler(event.request);
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = null;
	if (session) {
		const [person] = await db.select().from(user).where(eq(user.id, session.user.id));
		if (person && !person.banned) event.locals.user = person;
	}
	return resolve(event);
};
