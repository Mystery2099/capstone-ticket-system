import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { error } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAssignableRole } from './roles';
import { account, category, securityEvent, session, user } from './schema';
import type { AdminCreateUserInput, AdminUpdateUserInput, AdminCategoryInput } from './validation';

/** Account and audit writes commit together; credentials never enter the audit record. */
export async function createManagedUser(
	actorId: string,
	input: AdminCreateUserInput
): Promise<string> {
	const passwordHash = await hashPassword(input.password);
	return db.transaction(async (transaction) => {
		await requireAssignableRole(transaction, input.role);
		const userId = randomUUID();
		await transaction.insert(user).values({
			id: userId,
			name: input.name,
			email: input.email,
			role: input.role,
			banned: false,
			emailVerified: false
		});
		await transaction.insert(account).values({
			id: randomUUID(),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: passwordHash,
			updatedAt: new Date()
		});
		await transaction
			.insert(securityEvent)
			.values({ actorId, action: 'user.created', targetId: userId, details: { role: input.role } });
		return userId;
	});
}

export async function updateManagedUser(
	actorId: string,
	input: AdminUpdateUserInput
): Promise<void> {
	const { id, name, email, role, enabled } = input;
	if (id === actorId && (role !== 'admin' || !enabled))
		error(400, 'You cannot remove your own administrator access.');
	await db.transaction(async (transaction) => {
		await requireAssignableRole(transaction, role);
		await transaction.execute(
			sql`SELECT id FROM "user" WHERE role = 'admin' ORDER BY id FOR UPDATE`
		);
		const [previousUser] = await transaction
			.select()
			.from(user)
			.where(eq(user.id, id))
			.for('update');
		if (!previousUser) error(404, 'Account not found.');
		if (!enabled || role !== 'admin') {
			const enabledAdministrators = await transaction
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.role, 'admin'), eq(user.banned, false)));
			if (enabledAdministrators.length === 1 && enabledAdministrators[0].id === id)
				error(400, 'Keep at least one enabled administrator.');
		}
		await transaction
			.update(user)
			.set({
				name,
				email,
				role,
				banned: !enabled,
				emailVerified: email === previousUser.email ? previousUser.emailVerified : false,
				updatedAt: new Date()
			})
			.where(eq(user.id, id));
		if (!enabled || role !== previousUser.role || email !== previousUser.email)
			await transaction.delete(session).where(eq(session.userId, id));
		await transaction.insert(securityEvent).values({
			actorId,
			action: 'user.updated',
			targetId: id,
			details: {
				before: {
					name: previousUser.name,
					email: previousUser.email,
					role: previousUser.role,
					enabled: !previousUser.banned
				},
				after: { name, email, role, enabled }
			}
		});
	});
}

export async function saveManagedCategory(
	actorId: string,
	input: AdminCategoryInput
): Promise<string> {
	return db.transaction(async (transaction) => {
		let categoryId = input.id;
		if (categoryId) {
			const [previousCategory] = await transaction
				.select()
				.from(category)
				.where(eq(category.id, categoryId))
				.for('update');
			if (!previousCategory) error(404, 'Category not found.');
			await transaction
				.update(category)
				.set({ name: input.name, active: input.active, updatedAt: new Date() })
				.where(eq(category.id, categoryId));
			await transaction.insert(securityEvent).values({
				actorId,
				action: 'category.updated',
				targetId: categoryId,
				details: {
					before: { name: previousCategory.name, active: previousCategory.active },
					after: { name: input.name, active: input.active }
				}
			});
		} else {
			const [createdCategory] = await transaction
				.insert(category)
				.values({ name: input.name })
				.returning();
			categoryId = createdCategory.id;
			await transaction.insert(securityEvent).values({
				actorId,
				action: 'category.created',
				targetId: categoryId,
				details: { name: input.name }
			});
		}
		return categoryId;
	});
}
