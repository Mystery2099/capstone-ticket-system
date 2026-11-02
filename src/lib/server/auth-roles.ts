import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';

/** Roles for the Better Auth admin plugin. Only administrators may create accounts. */
export const accessControl = createAccessControl(defaultStatements);
export const roles = {
	admin: accessControl.newRole({ user: ['create', 'set-role'] }),
	agent: accessControl.newRole({ user: [] }),
	requester: accessControl.newRole({ user: [] })
};

/** Every admin plugin route, so none of them can be reached over HTTP. */
export const adminPaths = [
	'/admin/set-role',
	'/admin/get-user',
	'/admin/create-user',
	'/admin/update-user',
	'/admin/list-users',
	'/admin/list-user-sessions',
	'/admin/unban-user',
	'/admin/ban-user',
	'/admin/impersonate-user',
	'/admin/stop-impersonating',
	'/admin/revoke-user-session',
	'/admin/revoke-user-sessions',
	'/admin/remove-user',
	'/admin/set-user-password',
	'/admin/has-permission'
];
