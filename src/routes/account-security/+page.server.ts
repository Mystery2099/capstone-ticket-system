import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user?.twoFactorEnabled) redirect(303, '/app/tickets');
	return { enrollment: !!locals.user };
};
