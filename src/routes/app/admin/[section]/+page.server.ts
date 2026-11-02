import { error, fail, isHttpError } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { message, setError, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	createManagedUser,
	updateManagedUser,
	saveManagedCategory
} from '$lib/server/administration';
import { db } from '$lib/server/db';
import { user, category } from '$lib/server/schema';
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
	if (person.role !== 'admin' || !person.twoFactorEnabled)
		error(403, 'Administrator access required.');
	return person;
}

function requireFreshAdministrator(locals: App.Locals): Person {
	const actor = requireAdmin(locals.user);
	if (!locals.sessionCreatedAt || Date.now() - locals.sessionCreatedAt.getTime() > 15 * 60 * 1000)
		error(403, 'Sign out and sign in again before changing accounts or categories.');
	return actor;
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
	throw e;
}

export const actions: Actions = {
	createUser: async ({ locals, request }) => {
		const actor = requireFreshAdministrator(locals);
		const form = await superValidate(request, createUserSchema);
		const { name, email, password, role } = form.data;
		// The password is only needed here, so it doesn't travel back in the response.
		form.data.password = '';
		if (!form.valid) return fail(400, { form });
		try {
			const createdId = await createManagedUser(actor.id, { name, email, password, role });
			return message(form, { text: 'User created.', createdId });
		} catch (e) {
			if (uniqueViolation(e))
				return setError(form, 'email', 'Another account already uses this email.');
			return failure(form, e);
		}
	},
	user: async ({ locals, request }) => {
		const actor = requireFreshAdministrator(locals);
		const form = await superValidate(request, updateUserSchema);
		if (!form.valid) return fail(400, { form });
		const { id, name, email, role, enabled } = form.data;
		try {
			await updateManagedUser(actor.id, { id, name, email, role, enabled });
			return message(form, { text: 'User updated.' });
		} catch (e) {
			if (uniqueViolation(e))
				return setError(form, 'email', 'Another account already uses this email.');
			return failure(form, e);
		}
	},
	category: async ({ locals, request }) => {
		const actor = requireFreshAdministrator(locals);
		const form = await superValidate(request, categorySchema);
		if (!form.valid) return fail(400, { form });
		const { id, name, active } = form.data;
		try {
			const savedId = await saveManagedCategory(actor.id, { id, name, active });
			return message(form, {
				text: id ? 'Category saved.' : 'Category added.',
				...(!id ? { createdId: savedId } : {})
			});
		} catch (e) {
			if (uniqueViolation(e))
				return setError(form, 'name', 'A category with that name already exists.');
			return failure(form, e);
		}
	}
};
