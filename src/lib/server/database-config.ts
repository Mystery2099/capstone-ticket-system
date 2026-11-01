import { z } from 'zod';

/** Explicit local storage keeps test processes isolated from hosted credentials. */
export function databaseConfig(env: NodeJS.ProcessEnv) {
	if (env.DATABASE_URL) return { kind: 'url' as const, url: env.DATABASE_URL };
	if (env.DATA_DIR) return { kind: 'local' as const, directory: env.DATA_DIR };
	if (env.PGHOST) {
		const result = z
			.object({
				PGHOST: z.string().trim().min(1),
				PGUSER: z.string().trim().min(1),
				PGDATABASE: z.string().trim().min(1),
				PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
				PGPASSWORD: z.string().min(1)
			})
			.safeParse(env);
		if (!result.success) {
			const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))].join(', ');
			throw new Error(
				`Complete the PostgreSQL settings in .env: ${names}. No local database fallback was used.`
			);
		}
		const p = result.data;
		return {
			kind: 'postgres' as const,
			options: {
				host: p.PGHOST,
				port: p.PGPORT,
				username: p.PGUSER,
				database: p.PGDATABASE,
				password: p.PGPASSWORD,
				ssl: { rejectUnauthorized: true },
				max: 5
			}
		};
	}
	if (env.NODE_ENV === 'production')
		throw new Error(
			'Set DATABASE_URL or PGHOST/PGUSER/PGDATABASE/PGPASSWORD for hosted PostgreSQL, or DATA_DIR for an explicit local demo.'
		);
	return { kind: 'local' as const, directory: '.data/postgres' };
}
