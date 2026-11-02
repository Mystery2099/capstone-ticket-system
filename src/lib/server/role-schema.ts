import { pgTable, text, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { Permission } from '../permissions';

export const applicationRole = pgTable('application_role', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	permissions: jsonb('permissions').$type<Permission[]>().notNull().default([])
}, (table) => [uniqueIndex('application_role_name_unique').on(sql`lower(${table.name})`)]);
