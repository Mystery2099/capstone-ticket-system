import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// References the generated Better Auth user model.
import { user } from './auth-schema';

const createdAtColumn = () =>
	timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAtColumn = () =>
	timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const category = pgTable(
	'category',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: createdAtColumn(),
		updatedAt: updatedAtColumn()
	},
	(table) => [
		uniqueIndex('category_name_ci_unique').on(sql`lower(${table.name})`),
		check('category_name_not_blank', sql`length(trim(${table.name})) > 0`)
	]
);

export const ticketStatus = pgTable('ticket_status', {
	code: text('code').primaryKey(),
	label: text('label').notNull(),
	sortOrder: bigint('sort_order', { mode: 'number' }).notNull()
});

export const ticket = pgTable(
	'ticket',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ticketNumber: bigint('ticket_number', { mode: 'number' }).generatedAlwaysAsIdentity().notNull(),
		requesterId: text('requester_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		assignedToUserId: text('assigned_to_user_id').references(() => user.id, {
			onDelete: 'restrict'
		}),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'restrict' }),
		statusCode: text('status_code')
			.notNull()
			.default('open')
			.references(() => ticketStatus.code, { onDelete: 'restrict' }),
		priority: text('priority').notNull().default('normal'),
		subject: text('subject').notNull(),
		description: text('description').notNull(),
		createdAt: createdAtColumn(),
		updatedAt: updatedAtColumn(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		closedAt: timestamp('closed_at', { withTimezone: true })
	},
	(table) => [
		uniqueIndex('ticket_number_unique').on(table.ticketNumber),
		index('ticket_requester_created_idx').on(table.requesterId, table.createdAt),
		index('ticket_assignee_created_idx').on(table.assignedToUserId, table.createdAt),
		index('ticket_status_created_idx').on(table.statusCode, table.createdAt),
		check('ticket_priority_valid', sql`${table.priority} in ('low', 'normal', 'high')`),
		check('ticket_subject_not_blank', sql`length(trim(${table.subject})) > 0`),
		check('ticket_description_not_blank', sql`length(trim(${table.description})) > 0`)
	]
);

export const ticketComment = pgTable(
	'ticket_comment',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ticketId: uuid('ticket_id')
			.notNull()
			.references(() => ticket.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		body: text('body').notNull(),
		isInternal: boolean('is_internal').notNull().default(false),
		createdAt: createdAtColumn()
	},
	(table) => [
		index('ticket_comment_ticket_created_idx').on(table.ticketId, table.createdAt),
		check('ticket_comment_body_not_blank', sql`length(trim(${table.body})) > 0`)
	]
);

export const ticketEvent = pgTable(
	'ticket_event',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ticketId: uuid('ticket_id')
			.notNull()
			.references(() => ticket.id, { onDelete: 'cascade' }),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'restrict' }),
		eventType: text('event_type').notNull(),
		details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
		createdAt: createdAtColumn()
	},
	(table) => [index('ticket_event_ticket_created_idx').on(table.ticketId, table.createdAt)]
);

/** Security events are separate from ticket conversations and contain no credentials. */
export const securityEvent = pgTable(
	'security_event',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'restrict' }),
		action: text('action').notNull(),
		targetId: text('target_id').notNull(),
		details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
		createdAt: createdAtColumn()
	},
	(table) => [index('security_event_created_idx').on(table.createdAt)]
);
