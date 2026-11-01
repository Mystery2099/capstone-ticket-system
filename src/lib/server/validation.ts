import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { statuses } from '../status';

type Status = keyof typeof statuses;

/**
 * Shared Zod schemas for server actions. Every schema keeps the friendly,
 * user-facing error wording that the handrolled helpers used, so actions can
 * surface the first issue verbatim (see parseForm) without duplication.
 */
const requiredText = (label: string, max: number) =>
	`${label} is required and must be ${max} characters or fewer.`;

/** Non-empty, trimmed text of at most `max` characters. */
export const boundedText = (label: string, max: number) =>
	z
		.string(requiredText(label, max))
		.trim()
		.min(1, requiredText(label, max))
		.max(max, requiredText(label, max));

/** RFC 9562 UUID string (category ids are UUID columns; user ids are not). */
export const uuid = (message: string) => z.uuid(message).trim();

/** Parse arbitrary input against a schema, rejecting invalid input with a friendly 400. */
export function parseForm<Schema extends z.ZodType>(
	schema: Schema,
	data: unknown
): z.output<Schema> {
	const result = schema.safeParse(data);
	if (!result.success) error(400, result.error.issues[0]?.message || 'Invalid input.');
	return result.data;
}

// ---------------------------------------------------------------- tickets ---

export const createTicketSchema = z.object({
	subject: boundedText('Subject', 180),
	description: boundedText('Description', 4000),
	categoryId: uuid('Choose an active category.')
});
export type CreateTicketInput = z.output<typeof createTicketSchema>;

export const replySchema = z.object({
	body: boundedText('Message', 10000)
});
export type ReplyInput = z.output<typeof replySchema>;

/** Ticket numbers are generated bigint identities; a safe integer is required. */
const ticketNumberSchema = z.number('Ticket not found.').int('Ticket not found.');

/** Validate a ticket number from untrusted input; malformed input means no ticket. */
export function parseTicketNumber(value: unknown): number {
	const result = ticketNumberSchema.safeParse(value);
	if (!result.success) error(404, 'Ticket not found.');
	return result.data;
}

/** The metadata columns a ticket may be mutated on, one value schema each. */
export const ticketUpdateFields = [
	'statusCode',
	'priority',
	'categoryId',
	'assignedToUserId'
] as const;
export type TicketUpdateField = (typeof ticketUpdateFields)[number];

const statusValues = Object.keys(statuses) as [Status, ...Status[]];

export const ticketUpdateValueSchemas = {
	statusCode: z.enum(statusValues, 'Invalid status.'),
	priority: z.enum(['low', 'normal', 'high'], 'Invalid priority.'),
	categoryId: uuid('Choose an active category.'),
	assignedToUserId: z.string()
} as const satisfies Record<TicketUpdateField, z.ZodType>;

export const ticketUpdateFieldSchema = z.enum(ticketUpdateFields, 'Invalid field.');

/**
 * Validate the metadata field name alone: the caller can reject the raw value
 * against permissions (closed/read-only rules) before the value is parsed.
 */
export function parseTicketUpdateField(field: string): TicketUpdateField {
	return parseForm(z.object({ field: ticketUpdateFieldSchema }), { field }).field;
}

/** Validate a metadata update value against the schema for its known field. */
export function parseTicketUpdateValue(field: TicketUpdateField, value: string) {
	const result = ticketUpdateValueSchemas[field].safeParse(value);
	if (!result.success) error(400, result.error.issues[0]?.message || 'Invalid input.');
	return result.data as string;
}

/**
 * One-shot validation of a (field, value) pair for callers that do not need
 * to run permission checks between the two halves.
 */
export const ticketUpdateSchema = z.discriminatedUnion(
	'field',
	[
		z.object({ field: z.literal('statusCode'), value: ticketUpdateValueSchemas.statusCode }),
		z.object({ field: z.literal('priority'), value: ticketUpdateValueSchemas.priority }),
		z.object({ field: z.literal('categoryId'), value: ticketUpdateValueSchemas.categoryId }),
		z.object({
			field: z.literal('assignedToUserId'),
			value: ticketUpdateValueSchemas.assignedToUserId
		})
	],
	'Invalid field.'
);
export type TicketUpdateInput = z.output<typeof ticketUpdateSchema>;

// ------------------------------------------------------------------ admin ---

export const roleSchema = z.enum(['requester', 'agent', 'admin'], 'Choose a valid role.');

/** Trimmed, lower-cased email enforced before any address format check. */
const adminEmailSchema = z
	.string(requiredText('Email', 254))
	.trim()
	.min(1, requiredText('Email', 254))
	.max(254, requiredText('Email', 254))
	.pipe(z.email('Enter a valid email address.'))
	.transform((v) => v.toLowerCase());

const displayNameSchema = boundedText('Display name', 100);

const passwordSchema = boundedText('Password', 128).refine(
	(v) => v.length >= 12,
	'Use a password with at least 12 characters.'
);

/** Fields a user-select sends when the administrator creates an account. */
export const adminCreateUserSchema = z.object({
	name: displayNameSchema,
	email: adminEmailSchema,
	password: passwordSchema,
	role: roleSchema
});
export type AdminCreateUserInput = z.output<typeof adminCreateUserSchema>;

/** Fields a user-select sends when editing an existing account. */
export const adminUpdateUserSchema = z.object({
	id: z.string().trim().min(1, 'Choose an account to update.').max(254),
	name: displayNameSchema,
	email: adminEmailSchema,
	role: roleSchema
});
export type AdminUpdateUserInput = z.output<typeof adminUpdateUserSchema>;

/** Category create/edit: name always; id only when the form targets a row. */
export const adminCategorySchema = z.object({
	name: boundedText('Category name', 80),
	id: z.preprocess(
		(v) => (v == null || v === '' ? undefined : v),
		uuid('Invalid category identifier.').optional()
	)
});
export type AdminCategoryInput = z.output<typeof adminCategorySchema>;
