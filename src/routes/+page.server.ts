import { redirect } from '@sveltejs/kit';
export const load = ({ locals }: { locals: App.Locals }) =>
    redirect(303, locals.user ? '/app/tickets' : '/login');
