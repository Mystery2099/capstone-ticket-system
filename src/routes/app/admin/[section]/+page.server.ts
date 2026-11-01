import { error, fail, isHttpError } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq, asc, sql, and } from 'drizzle-orm';
import { message, setError, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user, category, session } from '$lib/server/schema';
import { requireUser, type Person } from '$lib/server/tickets';
import {
	adminCategorySchema,
	adminCreateUserSchema,
	adminUpdateUserSchema
} from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

const createUserSchema = zod4(adminCreateUserSchema);
const updateUserSchema = zod4(adminUpdateUserSchema);
const categorySchema = zod4(adminCategorySchema);

/**
 * Returns the signed-in administrator. Every load and action here calls this first.
 *
 * @throws 403 when the signed-in person isn't an administrator
 */
function requireAdmin(currentUser: App.Locals['user']): Person {
	const person = requireUser(currentUser);
	if (person.role !== 'admin') error(403, 'Administrator access required.');
	return person;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requireAdmin(locals.user);
	if (!['users', 'categories'].includes(params.section)) error(404);
	return {
		section: params.section,
		users: await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				banned: user.banned
			})
			.from(user)
			.orderBy(asc(user.name)),
		categories: await db.select().from(category).orderBy(asc(category.name)),
		createUserForm: await superValidate(createUserSchema, { id: 'create-user' }),
		userForm: await superValidate(updateUserSchema, { id: 'user' }),
		createCategoryForm: await superValidate(categorySchema, { id: 'create-category' }),
		categoryForm: await superValidate(categorySchema, { id: 'category' })
	};
};
const uniqueViolation = (e: unknown) =>
	(e as { cause?: { code?: string } }).cause?.code === '23505' ||
	(e as { code?: string }).code === '23505';

/** Turns an expected failure into a message on the form, and rethrows anything else. */
function failure<T extends Record<string, unknown>>(form: SuperValidated<T>, e: unknown) {
	if (isHttpError(e)) return message(form, { text: e.body.message, failed: true }, { status: 400 });
	if (e instanceof APIError)
		return message(form, { text: e.message, failed: true }, { status: 400 });
	throw e;
}

export const actions: Actions = {
	createUser: async ({ locals, request }) => {
		requireAdmin(locals.user);
		const form = await superValidate(request, createUserSchema);
		const { name, email, password, role } = form.data;
		// The password is only needed here, so it doesn't travel back in the response.
		form.data.password = '';
		if (!form.valid) return fail(400, { form });
		try {
			const { user: created } = await auth.api.createUser({
				headers: request.headers,
				body: { name, email, password, role, data: { emailVerified: true } }
			});
			return message(form, { text: 'User created.', createdId: created.id });
		} catch (e) {
			if (e instanceof APIError && e.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
				return setError(form, 'email', 'Another account already uses this email.');
			return failure(form, e);
		}
	},
	user: async ({ locals, request }) => {
		const actor = requireAdmin(locals.user);
		const form = await superValidate(request, updateUserSchema);
		if (!form.valid) return fail(400, { form });
		const { id, name, email, role, enabled } = form.data;
		try {
			if (id === actor.id && (role !== 'admin' || !enabled))
				error(400, 'You cannot remove your own administrator access.');
			await db.transaction(async (tx) => {
				await tx.execute(sql`SELECT id FROM "user" WHERE role = 'admin' FOR UPDATE`);
				if (!enabled || role !== 'admin') {
					const admins = await tx
						.select()
						.from(user)
						.where(and(eq(user.role, 'admin'), eq(user.banned, false)));
					if (admins.length === 1 && admins[0].id === id)
						error(400, 'Keep at least one enabled administrator.');
				}
				await tx
					.update(user)
					.set({ name, email, role, banned: !enabled, updatedAt: new Date() })
					.where(eq(user.id, id));
				if (!enabled) await tx.delete(session).where(eq(session.userId, id));
			});
			return message(form, { text: 'User updated.' });
		} catch (e) {
			if (uniqueViolation(e))
				return setError(form, 'email', 'Another account already uses this email.');
			return failure(form, e);
		}
	},
	category: async ({ locals, request }) => {
		requireAdmin(locals.user);
		const form = await superValidate(request, categorySchema);
		if (!form.valid) return fail(400, { form });
		const { id, name, active } = form.data;
		try {
			if (!id) {
				const [created] = await db.insert(category).values({ name }).returning();
				return message(form, { text: 'Category added.', createdId: created.id });
			}
			await db
				.update(category)
				.set({ name, active, updatedAt: new Date() })
				.where(eq(category.id, id));
			return message(form, { text: 'Category saved.' });
		} catch (e) {
			if (uniqueViolation(e))
				return setError(form, 'name', 'A category with that name already exists.');
			return failure(form, e);
		}
	}
};
