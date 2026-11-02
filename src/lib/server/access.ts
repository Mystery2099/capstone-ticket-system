import { error } from '@sveltejs/kit';
import { ticket, user } from './schema';
import { hasPermission } from '../permissions';

export type Person = typeof user.$inferSelect & {
	permissions?: import('../permissions').Permission[];
	roleName?: string;
};
type Ticket = typeof ticket.$inferSelect;

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
	if (!hasPermission(administrator, 'manageAdministration') || !administrator.twoFactorEnabled)
		error(403, 'Administrator access required.');
	return administrator;
}

/**
 * Checks that a person may see a ticket.
 *
 * @throws 404 rather than 403, so requesters can't tell which ticket numbers exist
 */
export function requireTicketAccess(actor: Person, ticketRecord: Ticket): void {
	if (!hasPermission(actor, 'viewAllTickets') && ticketRecord.requesterId !== actor.id)
		error(404, 'Ticket not found.');
}
