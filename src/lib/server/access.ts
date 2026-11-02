import { error } from '@sveltejs/kit';
import { user } from './schema';

/** How long a sign-in counts as recent enough to change accounts or categories. */
const FRESH_SESSION_MAX_AGE_MS = 15 * 60 * 1000;

export type Person = typeof user.$inferSelect;

export function isStaff(person: Pick<Person, 'role'>): boolean {
	return person.role === 'agent' || person.role === 'admin';
}

/**
 * Returns the signed-in person, or rejects the request.
 *
 * @throws 401 when nobody is signed in or the account is disabled
 */
export function requireUser(person: Person | null): Person {
	if (!person || person.banned) error(401, 'Please sign in.');
	return person;
}

/**
 * Returns the signed-in administrator.
 *
 * @throws 403 when the signed-in person isn't an administrator with two-factor sign-in
 */
export function requireAdministrator(person: Person | null): Person {
	const administrator = requireUser(person);
	if (administrator.role !== 'admin' || !administrator.twoFactorEnabled)
		error(403, 'Administrator access required.');
	return administrator;
}

/**
 * Returns the signed-in administrator, if they signed in recently.
 *
 * @throws 403 when the session is older than the allowed age
 */
export function requireFreshAdministrator(locals: App.Locals): Person {
	const administrator = requireAdministrator(locals.user);
	const sessionAge = locals.sessionCreatedAt
		? Date.now() - locals.sessionCreatedAt.getTime()
		: Infinity;
	if (sessionAge > FRESH_SESSION_MAX_AGE_MS)
		error(403, 'Sign out and sign in again before changing accounts or categories.');
	return administrator;
}
