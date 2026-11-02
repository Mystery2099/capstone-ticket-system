import { z } from 'zod';

/**
 * Form schemas shared by the browser and the server. The browser checks them before
 * submitting so mistakes show at once. The server always checks them again, since a request
 * can skip the browser entirely. Server-only parsing helpers live in $lib/server/validation.
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

// ------------------------------------------------------------------ admin ---

export const roleSchema = z.string().trim().min(1, 'Choose a valid role.').max(100);

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
