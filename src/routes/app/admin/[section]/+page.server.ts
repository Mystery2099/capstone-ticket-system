import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { message, setError, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	createManagedUser,
	updateManagedUser,
	saveManagedCategory
} from '$lib/server/administration';
import { requireAdministrator } from '$lib/server/access';
import { db } from '$lib/server/db';
import { loadRoles, saveRole, deleteRole } from '$lib/server/roles';
import { user, category } from '$lib/server/schema';
import { adminCategorySchema, adminCreateUserSchema, adminUpdateUserSchema } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';

const createUserFormSchema = zod4(adminCreateUserSchema);
const updateUserFormSchema = zod4(adminUpdateUserSchema);
const categoryFormSchema = zod4(adminCategorySchema);

export const load: PageServerLoad = async ({ locals, params }) => {
	requireAdministrator(locals.user);
	if (!['users', 'categories', 'roles'].includes(params.section)) error(404);
	return {
		section: params.section,
		roles: await loadRoles(),
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
		createUserForm: await superValidate(createUserFormSchema, { id: 'create-user' }),
		updateUserForm: await superValidate(updateUserFormSchema, { id: 'user' }),
		createCategoryForm: await superValidate(categoryFormSchema, { id: 'create-category' }),
		updateCategoryForm: await superValidate(categoryFormSchema, { id: 'category' })
	};
};
const isUniqueViolation = (caughtError: unknown) =>
	(caughtError as { cause?: { code?: string } }).cause?.code === '23505' ||
	(caughtError as { code?: string }).code === '23505';

/** Turns an expected failure into a message on the form, and rethrows anything else. */
function buildFailureMessage<T extends Record<string, unknown>>(
	form: SuperValidated<T>,
	caughtError: unknown
) {
	if (isHttpError(caughtError))
		return message(form, { text: caughtError.body.message, failed: true }, { status: 400 });
	throw caughtError;
}

export const actions: Actions = {
	saveRole: async ({ locals, request }) => {
		const actor = requireAdministrator(locals.user);
		const fields = await request.formData();
		let savedId;
		try {
			savedId = await saveRole(actor.id, {
				id: String(fields.get('id') || ''),
				name: String(fields.get('name') || ''),
				permissions: fields.getAll('permissions').map(String)
			});
		} catch (caughtError) {
			if (isUniqueViolation(caughtError))
				return fail(400, { roleError: 'Another role already uses this name.' });
			if (isHttpError(caughtError))
				return fail(caughtError.status, { roleError: caughtError.body.message });
			throw caughtError;
		}
		redirect(303, '/app/admin/roles?id=' + savedId);
	},
	deleteRole: async ({ locals, request }) => {
		const actor = requireAdministrator(locals.user);
		const fields = await request.formData();
		try {
			await deleteRole(
				actor.id,
				String(fields.get('id') || ''),
				String(fields.get('replacementRoleId') || '')
			);
		} catch (caughtError) {
			if (isHttpError(caughtError))
				return fail(caughtError.status, { roleError: caughtError.body.message });
			throw caughtError;
		}
		redirect(303, '/app/admin/roles');
	},
	createUser: async ({ locals, request }) => {
		const actor = requireAdministrator(locals.user);
		const form = await superValidate(request, createUserFormSchema);
		const { name, email, password, role } = form.data;
		// The password is only needed here, so it doesn't travel back in the response.
		form.data.password = '';
		if (!form.valid) return fail(400, { form });
		try {
			const createdId = await createManagedUser(actor.id, { name, email, password, role });
			return message(form, { text: 'User created.', createdId });
		} catch (caughtError) {
			if (isUniqueViolation(caughtError))
				return setError(form, 'email', 'Another account already uses this email.');
			return buildFailureMessage(form, caughtError);
		}
	},
	updateUser: async ({ locals, request }) => {
		const actor = requireAdministrator(locals.user);
		const form = await superValidate(request, updateUserFormSchema);
		if (!form.valid) return fail(400, { form });
		const { id, name, email, role, enabled } = form.data;
		try {
			await updateManagedUser(actor.id, { id, name, email, role, enabled });
			return message(form, { text: 'User updated.' });
		} catch (caughtError) {
			if (isUniqueViolation(caughtError))
				return setError(form, 'email', 'Another account already uses this email.');
			return buildFailureMessage(form, caughtError);
		}
	},
	saveCategory: async ({ locals, request }) => {
		const actor = requireAdministrator(locals.user);
		const form = await superValidate(request, categoryFormSchema);
		if (!form.valid) return fail(400, { form });
		const { id, name, active } = form.data;
		try {
			const savedCategoryId = await saveManagedCategory(actor.id, { id, name, active });
			return message(form, {
				text: id ? 'Category saved.' : 'Category added.',
				...(!id ? { createdId: savedCategoryId } : {})
			});
		} catch (caughtError) {
			if (isUniqueViolation(caughtError))
				return setError(form, 'name', 'A category with that name already exists.');
			return buildFailureMessage(form, caughtError);
		}
	}
};
