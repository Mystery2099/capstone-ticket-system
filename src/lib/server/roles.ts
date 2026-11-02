import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { applicationRole, securityEvent, session, user } from './schema';
import { PERMISSION_LABELS, ROLE_PERMISSIONS, type Permission } from '../permissions';

export function loadRoles() {
	return db.select().from(applicationRole).orderBy(asc(applicationRole.name));
}

export function applyRolePermissions<T extends { role: string | null }>(
	person: T,
	roles: Awaited<ReturnType<typeof loadRoles>>
): T & { permissions: Permission[]; roleName: string } {
	const role = roles.find((role) => role.id === person.role);
	return {
		...person,
		permissions: person.role === 'admin' ? [...ROLE_PERMISSIONS.admin] : (role?.permissions ?? []),
		roleName: role?.name ?? 'Unknown role'
	};
}

type RoleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Role assignment and deletion use the same lock, so no user receives a deleted role. */
export async function requireAssignableRole(transaction: RoleTransaction, roleId: string) {
	const [role] = await transaction
		.select()
		.from(applicationRole)
		.where(eq(applicationRole.id, roleId))
		.for('update');
	if (!role) error(400, 'Choose an existing role.');
	return role;
}

export async function saveRole(
	actorId: string,
	input: { id: string; name: string; permissions: string[] }
) {
	const name = input.name.trim();
	if (!name || name.length > 80)
		error(400, 'Role name is required and must be 80 characters or fewer.');
	if (input.id === 'admin') error(400, 'Administrator is protected.');
	if (
		input.permissions.some(
			(permission) =>
				!Object.hasOwn(PERMISSION_LABELS, permission) || permission === 'manageAdministration'
		)
	)
		error(400, 'Choose valid permissions. Administration is reserved for Administrator.');
	const permissions = [...new Set(input.permissions)] as Permission[];
	return db.transaction(async (transaction) => {
		const id = input.id || randomUUID();
		if (input.id) {
			await requireAssignableRole(transaction, id);
			await transaction
				.update(applicationRole)
				.set({ name, permissions })
				.where(eq(applicationRole.id, id));
		} else await transaction.insert(applicationRole).values({ id, name, permissions });
		await transaction
			.insert(securityEvent)
			.values({
				actorId,
				action: input.id ? 'role.updated' : 'role.created',
				targetId: id,
				details: { name, permissions }
			});
		return id;
	});
}

export async function deleteRole(actorId: string, roleId: string, replacementRoleId: string) {
	if (!roleId || roleId === 'admin') error(400, 'Administrator is protected.');
	if (roleId === replacementRoleId || replacementRoleId === 'admin')
		error(400, 'Choose a different non-administrator replacement role.');
	return db.transaction(async (transaction) => {
		// Stable ordering avoids deadlocks when two administrators reassign opposite roles.
		const roleIds = [roleId, replacementRoleId].filter(Boolean).sort();
		await transaction.execute(
			sql`SELECT id FROM application_role WHERE id IN (${sql.join(
				roleIds.map((id) => sql`${id}`),
				sql`, `
			)}) ORDER BY id FOR UPDATE`
		);
		const [role] = await transaction
			.select()
			.from(applicationRole)
			.where(eq(applicationRole.id, roleId));
		if (!role) error(404, 'Role not found.');
		const members = await transaction
			.select({ id: user.id })
			.from(user)
			.where(eq(user.role, roleId));
		if (members.length) {
			await requireAssignableRole(transaction, replacementRoleId);
			await transaction
				.update(user)
				.set({ role: replacementRoleId, updatedAt: new Date() })
				.where(eq(user.role, roleId));
			await transaction.delete(session).where(
				inArray(
					session.userId,
					members.map((member) => member.id)
				)
			);
		}
		await transaction.delete(applicationRole).where(eq(applicationRole.id, roleId));
		await transaction
			.insert(securityEvent)
			.values({
				actorId,
				action: 'role.deleted',
				targetId: roleId,
				details: {
					name: role.name,
					replacementRoleId,
					reassignedUserIds: members.map((member) => member.id)
				}
			});
	});
}
