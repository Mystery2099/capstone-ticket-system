export function validateProductionAuth(environment: NodeJS.ProcessEnv): void {
	if (environment.NODE_ENV !== 'production') return;
	if (!environment.BETTER_AUTH_SECRET || environment.BETTER_AUTH_SECRET.length < 32)
		throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters in production');
	if (environment.BETTER_AUTH_SECRET.startsWith('local-prototype-only'))
		throw new Error('Use a unique BETTER_AUTH_SECRET in production');
	let originUrl: URL;
	try {
		originUrl = new URL(environment.ORIGIN || '');
	} catch {
		throw new Error('ORIGIN must be a public HTTPS origin in production');
	}
	if (originUrl.protocol !== 'https:' || originUrl.origin !== environment.ORIGIN)
		throw new Error('ORIGIN must be an HTTPS origin without a path or trailing slash');
}

type RequestBucket = { count: number; expiresAt: number };

/** Process-local protection; a shared gateway must enforce limits across replicas. */
export class RequestLimiter {
	private readonly buckets = new Map<string, RequestBucket>();

	constructor(
		private readonly maximumRequests: number,
		private readonly windowMilliseconds: number,
		private readonly maximumBuckets = 10000
	) {}

	/** Returns the retry delay in seconds, or zero when the request is allowed. */
	recordRequest(bucketKey: string, now = Date.now()): number {
		let bucket = this.buckets.get(bucketKey);
		if (!bucket || bucket.expiresAt <= now) {
			for (const [storedKey, storedBucket] of this.buckets) {
				if (storedBucket.expiresAt <= now) this.buckets.delete(storedKey);
			}
			if (!bucket && this.buckets.size >= this.maximumBuckets) return 60;
			bucket = { count: 0, expiresAt: now + this.windowMilliseconds };
			this.buckets.set(bucketKey, bucket);
		}
		if (bucket.count >= this.maximumRequests) return Math.ceil((bucket.expiresAt - now) / 1000);
		bucket.count++;
		return 0;
	}
}

export function applySecurityHeaders(response: Response, isSecureRequest: boolean): Response {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Cache-Control', 'no-store');
	if (isSecureRequest) response.headers.set('Strict-Transport-Security', 'max-age=31536000');
	return response;
}
