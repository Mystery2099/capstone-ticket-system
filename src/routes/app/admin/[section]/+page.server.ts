import { error, fail, isHttpError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, category, session, account } from '$lib/server/schema';
import { eq, asc, sql, and } from 'drizzle-orm';
import { requireUser } from '$lib/server/tickets';
import {
	adminCategorySchema,
	adminCreateUserSchema,
	adminUpdateUserSchema,
	parseForm
} from '$lib/server/validation';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
function admin(u: App.Locals['user']) {
	const p = requireUser(u);
	if (p.role !== 'admin') error(403, 'Administrator access required.');
	return p;
}
export const load: PageServerLoad = async ({ locals, params }) => {
	admin(locals.user);
	if (!['users', 'categories'].includes(params.section)) error(404);
	return {
		section: params.section,
		users: await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				enabled: user.enabled
			})
			.from(user)
			.orderBy(asc(user.name)),
		categories: await db.select().from(category).orderBy(asc(category.name))
	};
};
function adminFailure(e: unknown) {
	if (isHttpError(e)) return fail(e.status, { error: e.body.message });
	if (
		(e as { cause?: { code?: string } }).cause?.code === '23505' ||
		(e as { code?: string }).code === '23505'
	)
		return fail(400, { error: 'Another account already uses this email.' });
	throw e;
}
export const actions: Actions = {
	createUser: async ({ locals, request }) => {
		admin(locals.user);
		try {
			const f = await request.formData();
			const { name, email, password, role } = parseForm(adminCreateUserSchema, {
				name: f.get('name'),
				email: f.get('email'),
				password: f.get('password'),
				role: String(f.get('role'))
			});
			const id = randomUUID(),
				hashed = await hashPassword(password);
			await db.transaction(async (tx) => {
				await tx.insert(user).values({ id, name, email, role, enabled: true, emailVerified: true });
				await tx.insert(account).values({
					id: randomUUID(),
					userId: id,
					accountId: id,
					providerId: 'credential',
					password: hashed,
					updatedAt: new Date()
				});
			});
			return { success: 'User created.', createdId: id };
		} catch (e) {
			return adminFailure(e);
		}
	},
	user: async ({ locals, request }) => {
		const actor = admin(locals.user);
		try {
			const f = await request.formData(),
				enabled = f.get('enabled') === 'true';
			const { id, name, email, role } = parseForm(adminUpdateUserSchema, {
				id: String(f.get('id')),
				name: f.get('name'),
				email: f.get('email'),
				role: String(f.get('role'))
			});
			if (id === actor.id && (role !== 'admin' || !enabled))
				return fail(400, { error: 'You cannot remove your own administrator access.' });
			await db.transaction(async (tx) => {
				await tx.execute(sql`SELECT id FROM "user" WHERE role = 'admin' FOR UPDATE`);
				if (!enabled || role !== 'admin') {
					const admins = await tx
						.select()
						.from(user)
						.where(and(eq(user.role, 'admin'), eq(user.enabled, true)));
					if (admins.length === 1 && admins[0].id === id)
						error(400, 'Keep at least one enabled administrator.');
				}
				await tx
					.update(user)
					.set({ name, email, role, enabled, updatedAt: new Date() })
					.where(eq(user.id, id));
				if (!enabled) await tx.delete(session).where(eq(session.userId, id));
			});
			return { success: 'User updated.' };
		} catch (e) {
			return adminFailure(e);
		}
	},
	category: async ({ locals, request }) => {
		admin(locals.user);
		const f = await request.formData();
		try {
			const { name, id } = parseForm(adminCategorySchema, {
				name: f.get('name'),
				id: String(f.get('id') || '')
			});
			if (!id) {
				const [created] = await db.insert(category).values({ name }).returning();
				return { success: 'Category added.', createdId: created.id };
			}
			await db
				.update(category)
				.set({ name, active: f.get('active') === 'true', updatedAt: new Date() })
				.where(eq(category.id, id));
			return { success: 'Category saved.' };
		} catch (e) {
			if (isHttpError(e)) return fail(e.status, { error: e.body.message });
			if (
				(e as { cause?: { code?: string } }).cause?.code === '23505' ||
				(e as { code?: string }).code === '23505'
			)
				return fail(400, { error: 'A category with that name already exists.' });
			throw e;
		}
	}
};
