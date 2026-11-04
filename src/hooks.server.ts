import { hasPermission } from '$lib/permissions';
import { building } from '$app/environment';
import { db } from '$lib/server/db';
import { applyRolePermissions } from '$lib/server/roles';
import { RequestCache } from '$lib/server/request-cache';
import { user } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { applySecurityHeaders, RequestLimiter } from '$lib/server/security';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
const writeRequestLimiter = new RequestLimiter(30, 60000);

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	const { auth } = await import('$lib/server/auth');
	if (event.url.pathname.startsWith('/api/auth/'))
		return applySecurityHeaders(await auth.handler(event.request), event.url.protocol === 'https:');
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = null;
	event.locals.requestCache = new RequestCache();
	if (session) {
		const [[person], roles] = await Promise.all([
			db.select().from(user).where(eq(user.id, session.user.id)),
			event.locals.requestCache.getRoles()
		]);
		if (person && !person.banned) event.locals.user = applyRolePermissions(person, roles);
	}
	if (
		hasPermission(event.locals.user, 'manageAdministration') &&
		!event.locals.user?.twoFactorEnabled &&
		event.url.pathname.startsWith('/app')
	)
		redirect(303, '/account-security');
	if (event.locals.user && event.request.method === 'POST') {
		const retryAfterSeconds = writeRequestLimiter.recordRequest(event.locals.user.id);
		if (retryAfterSeconds)
			return applySecurityHeaders(
				new Response('Too many requests. Please try again shortly.', {
					status: 429,
					headers: { 'Retry-After': String(retryAfterSeconds) }
				}),
				event.url.protocol === 'https:'
			);
	}
	return applySecurityHeaders(await resolve(event), event.url.protocol === 'https:');
};
