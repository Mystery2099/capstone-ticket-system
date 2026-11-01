import { isDemoEnabled } from '$lib/server/security';
import { redirect } from '@sveltejs/kit';
export const load = ({ locals }: { locals: App.Locals }) => {
	if (locals.user) redirect(303, '/app/tickets');
	return { demo: process.env.NODE_ENV !== 'production' || !!isDemoEnabled() };
};
