import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { error } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { account, category, securityEvent, session, user } from './schema';
import type { AdminCreateUserInput, AdminUpdateUserInput, AdminCategoryInput } from './validation';

/** Account and audit writes commit together; credentials never enter the audit record. */
export async function createManagedUser(
	actorId: string,
	input: AdminCreateUserInput
): Promise<string> {
	const passwordHash = await hashPassword(input.password);
	return db.transaction(async (tx) => {
		const id = randomUUID();
		await tx.insert(user).values({
			id,
			name: input.name,
			email: input.email,
			role: input.role,
			banned: false,
			emailVerified: false
		});
		await tx.insert(account).values({
			id: randomUUID(),
			accountId: id,
			providerId: 'credential',
			userId: id,
			password: passwordHash,
			updatedAt: new Date()
		});
		await tx
			.insert(securityEvent)
			.values({ actorId, action: 'user.created', targetId: id, details: { role: input.role } });
		return id;
	});
}

export async function updateManagedUser(
	actorId: string,
	input: AdminUpdateUserInput
): Promise<void> {
	const { id, name, email, role, enabled } = input;
	if (id === actorId && (role !== 'admin' || !enabled))
		error(400, 'You cannot remove your own administrator access.');
	await db.transaction(async (tx) => {
		await tx.execute(sql`SELECT id FROM "user" WHERE role = 'admin' ORDER BY id FOR UPDATE`);
		const [previous] = await tx.select().from(user).where(eq(user.id, id)).for('update');
		if (!previous) error(404, 'Account not found.');
		if (!enabled || role !== 'admin') {
			const administrators = await tx
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.role, 'admin'), eq(user.banned, false)));
			if (administrators.length === 1 && administrators[0].id === id)
				error(400, 'Keep at least one enabled administrator.');
		}
		await tx
			.update(user)
			.set({
				name,
				email,
				role,
				banned: !enabled,
				emailVerified: email === previous.email ? previous.emailVerified : false,
				updatedAt: new Date()
			})
			.where(eq(user.id, id));
		if (!enabled || role !== previous.role || email !== previous.email)
			await tx.delete(session).where(eq(session.userId, id));
		await tx.insert(securityEvent).values({
			actorId,
			action: 'user.updated',
			targetId: id,
			details: {
				before: {
					name: previous.name,
					email: previous.email,
					role: previous.role,
					enabled: !previous.banned
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
	return db.transaction(async (tx) => {
		let targetId = input.id;
		if (targetId) {
			const [previous] = await tx
				.select()
				.from(category)
				.where(eq(category.id, targetId))
				.for('update');
			if (!previous) error(404, 'Category not found.');
			await tx
				.update(category)
				.set({ name: input.name, active: input.active, updatedAt: new Date() })
				.where(eq(category.id, targetId));
			await tx.insert(securityEvent).values({
				actorId,
				action: 'category.updated',
				targetId,
				details: {
					before: { name: previous.name, active: previous.active },
					after: { name: input.name, active: input.active }
				}
			});
		} else {
			const [created] = await tx.insert(category).values({ name: input.name }).returning();
			targetId = created.id;
			await tx
				.insert(securityEvent)
				.values({ actorId, action: 'category.created', targetId, details: { name: input.name } });
		}
		return targetId;
	});
}
