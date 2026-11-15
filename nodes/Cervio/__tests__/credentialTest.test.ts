import { describe, expect, it, vi } from 'vitest';

import { cervioApiCredentialTest } from '../methods/credentialTest';

function ctx(request: ReturnType<typeof vi.fn>) {
	return { helpers: { request }, logger: console } as never;
}
const credential = (data: Record<string, unknown>) =>
	({ id: '1', name: 'Cervio', type: 'cervioApi', data }) as never;

describe('Cervio API credential test', () => {
	it('calls /api/v1/me with the token', async () => {
		const request = vi.fn(async () => ({ user_id: 'u' }));
		const res = await cervioApiCredentialTest.call(
			ctx(request),
			credential({ baseUrl: 'https://acme.cervio.app/', apiKey: 'cpat_x' }),
		);
		expect(res).toEqual({ status: 'OK', message: 'Connection successful' });
		expect(request).toHaveBeenCalledWith({
			method: 'GET',
			uri: 'https://acme.cervio.app/api/v1/me',
			headers: { Accept: 'application/json', Authorization: 'Bearer cpat_x' },
			json: true,
		});
	});

	it('never calls a metadata address', async () => {
		const request = vi.fn();
		const res = await cervioApiCredentialTest.call(
			ctx(request),
			credential({ baseUrl: 'http://169.254.169.254', apiKey: 'x' }),
		);
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/link-local/);
		expect(request).not.toHaveBeenCalled();
	});

	it('explains a rejected token', async () => {
		const request = vi.fn(async () => {
			throw Object.assign(new Error('401'), { statusCode: 401 });
		});
		const res = await cervioApiCredentialTest.call(
			ctx(request),
			credential({ baseUrl: 'https://acme.cervio.app', apiKey: 'bad' }),
		);
		expect(res).toEqual({
			status: 'Error',
			message: 'Cervio rejected the token: check that it is complete, not revoked and not expired.',
		});
	});

	it('shows Cervio’s message, or the transport error, for other failures', async () => {
		const withBody = vi.fn(async () => {
			throw Object.assign(new Error('403'), {
				statusCode: 403,
				error: { message: 'Missing scope' },
			});
		});
		expect(
			(await cervioApiCredentialTest.call(ctx(withBody), credential({ baseUrl: 'https://a.b' })))
				.message,
		).toBe('Missing scope');
		const offline = vi.fn(async () => {
			throw new Error('getaddrinfo ENOTFOUND a.b');
		});
		expect(
			(await cervioApiCredentialTest.call(ctx(offline), credential({ baseUrl: 'https://a.b' })))
				.message,
		).toBe('getaddrinfo ENOTFOUND a.b');
	});

	it('reports a missing Base URL', async () => {
		const res = await cervioApiCredentialTest.call(ctx(vi.fn()), credential({}));
		expect(res).toEqual({ status: 'Error', message: 'Cervio credential Base URL is missing' });
	});
});
