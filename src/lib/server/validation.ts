import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { TICKET_STATUSES } from '../status';

type Status = keyof typeof TICKET_STATUSES;

/**
 * Shared Zod schemas for server actions. Every schema keeps the friendly,
 * user-facing error wording that the handrolled helpers used, so actions can
 * surface the first issue verbatim (see parseFormInput) without duplication.
 */
const buildRequiredTextMessage = (fieldLabel: string, maximumLength: number) =>
	`${fieldLabel} is required and must be ${maximumLength} characters or fewer.`;

/** Non-empty, trimmed text of at most `maximumLength` characters. */
export const boundedTextSchema = (fieldLabel: string, maximumLength: number) =>
	z
		.string(buildRequiredTextMessage(fieldLabel, maximumLength))
		.trim()
		.min(1, buildRequiredTextMessage(fieldLabel, maximumLength))
		.max(maximumLength, buildRequiredTextMessage(fieldLabel, maximumLength));

/** RFC 9562 UUID string (category ids are UUID columns; user ids are not). */
export const uuidSchema = (message: string) => z.uuid(message).trim();

/** Parse arbitrary input against a schema, rejecting invalid input with a friendly 400. */
export function parseFormInput<Schema extends z.ZodType>(
	schema: Schema,
	input: unknown
): z.output<Schema> {
	const result = schema.safeParse(input);
	if (!result.success) error(400, result.error.issues[0]?.message || 'Invalid input.');
	return result.data;
}

// ---------------------------------------------------------------- tickets ---

export const createTicketSchema = z.object({
	subject: boundedTextSchema('Subject', 180),
	description: boundedTextSchema('Description', 4000),
	categoryId: uuidSchema('Choose an active category.')
});
export type CreateTicketInput = z.output<typeof createTicketSchema>;

export const commentSchema = z.object({
	body: boundedTextSchema('Message', 10000)
});
export type CommentInput = z.output<typeof commentSchema>;

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

const statusCodes = Object.keys(TICKET_STATUSES) as [Status, ...Status[]];

export const ticketUpdateValueSchemas = {
	statusCode: z.enum(statusCodes, 'Invalid status.'),
	priority: z.enum(['low', 'normal', 'high'], 'Invalid priority.'),
	categoryId: uuidSchema('Choose an active category.'),
	assignedToUserId: z.string()
} as const satisfies Record<TicketUpdateField, z.ZodType>;

export const ticketUpdateFieldSchema = z.enum(ticketUpdateFields, 'Invalid field.');

/**
 * Validate the metadata field name alone: the caller can reject the raw value
 * against permissions (closed/read-only rules) before the value is parsed.
 */
export function parseTicketUpdateField(field: string): TicketUpdateField {
	return parseFormInput(z.object({ field: ticketUpdateFieldSchema }), { field }).field;
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
	.string(buildRequiredTextMessage('Email', 254))
	.trim()
	.min(1, buildRequiredTextMessage('Email', 254))
	.max(254, buildRequiredTextMessage('Email', 254))
	.pipe(z.email('Enter a valid email address.'))
	.transform((email) => email.toLowerCase());

const displayNameSchema = boundedTextSchema('Display name', 100);

const passwordSchema = boundedTextSchema('Password', 128).refine(
	(password) => password.length >= 12,
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
	role: roleSchema,
	enabled: z.boolean()
});
export type AdminUpdateUserInput = z.output<typeof adminUpdateUserSchema>;

/** Category create/edit: name always; id only when the form targets a row. */
export const adminCategorySchema = z.object({
	name: boundedTextSchema('Category name', 80),
	id: uuidSchema('Invalid category identifier.').or(z.literal('')),
	active: z.boolean()
});
export type AdminCategoryInput = z.output<typeof adminCategorySchema>;
