/**
 * Reads that several loads of the same request need: roles, everyone's names and roles, and
 * categories. Each is read at most once per request. A new request reads them again, so
 * account, role and category changes still take effect on the very next request.
 */
import { asc } from 'drizzle-orm';
import { db } from './db';
import { applyRolePermissions, loadRoles } from './roles';
import { category, user } from './schema';

export type RoleRecord = Awaited<ReturnType<typeof loadRoles>>[number];
export type CategoryRecord = typeof category.$inferSelect;

async function readRoles(): Promise<RoleRecord[]> {
	return await loadRoles();
}

async function readPeople(roles: Promise<RoleRecord[]>) {
	const [loadedRoles, people] = await Promise.all([
		roles,
		db
			.select({ id: user.id, name: user.name, role: user.role, banned: user.banned })
			.from(user)
			.orderBy(asc(user.name))
	]);
	return people.map((person) => applyRolePermissions(person, loadedRoles));
}

export type PersonSummary = Awaited<ReturnType<typeof readPeople>>[number];

async function readCategories(): Promise<CategoryRecord[]> {
	return await db.select().from(category).orderBy(asc(category.name));
}

export class RequestCache {
	private rolesPromise: Promise<RoleRecord[]> | null = null;
	private peoplePromise: Promise<PersonSummary[]> | null = null;
	private categoriesPromise: Promise<CategoryRecord[]> | null = null;

	getRoles(): Promise<RoleRecord[]> {
		this.rolesPromise ??= readRoles();
		return this.rolesPromise;
	}

	/** Every person with their role's permissions, sorted by name. */
	getPeople(): Promise<PersonSummary[]> {
		this.peoplePromise ??= readPeople(this.getRoles());
		return this.peoplePromise;
	}

	/** Every category, sorted by name. */
	getCategories(): Promise<CategoryRecord[]> {
		this.categoriesPromise ??= readCategories();
		return this.categoriesPromise;
	}
}
