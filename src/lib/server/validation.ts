import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { TICKET_STATUSES } from '../status';
import { uuidSchema } from '../validation';

type Status = keyof typeof TICKET_STATUSES;

/**
 * Server-side parsing helpers. The form schemas themselves are shared with the browser and
 * live in $lib/validation; they are re-exported here so server code has one import.
 */
export * from '../validation';

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
