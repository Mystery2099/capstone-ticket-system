import { building } from '$app/environment';
import { initialize } from '$lib/server/init';
import { db } from '$lib/server/db';
import { user } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { applySecurityHeaders, RequestLimiter } from '$lib/server/security';
import type { Handle } from '@sveltejs/kit';
const writes = new RequestLimiter(30, 60000);

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	await initialize();
	const { auth } = await import('$lib/server/auth');
	if (event.url.pathname.startsWith('/api/auth/'))
		return applySecurityHeaders(await auth.handler(event.request), event.url.protocol === 'https:');
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = null;
	if (session) {
		const [person] = await db.select().from(user).where(eq(user.id, session.user.id));
		if (person && !person.banned) event.locals.user = person;
	}
	if (event.locals.user && event.request.method === 'POST') {
		const retryAfter = writes.check(event.locals.user.id);
		if (retryAfter)
			return applySecurityHeaders(
				new Response('Too many requests. Please try again shortly.', {
					status: 429,
					headers: { 'Retry-After': String(retryAfter) }
				}),
				event.url.protocol === 'https:'
			);
	}
	return applySecurityHeaders(await resolve(event), event.url.protocol === 'https:');
};
