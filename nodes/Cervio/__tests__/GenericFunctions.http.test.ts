import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeApiError } from 'n8n-workflow';

import { cervioApiRequest, createRecord, getRecord } from '../GenericFunctions';

function mockCtx(overrides: {
	baseUrl?: string;
	http?: ReturnType<typeof vi.fn>;
} = {}) {
	const http = overrides.http ?? vi.fn(async () => ({ ok: true }));
	return {
		getCredentials: vi.fn(async () => ({
			baseUrl: overrides.baseUrl ?? 'https://acme.cervio.app',
			apiKey: 'cpat_test',
		})),
		getNode: () => ({ name: 'Cervio' }),
		helpers: {
			httpRequestWithAuthentication: http,
		},
		_http: http,
	};
}

describe('cervioApiRequest', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('calls httpRequestWithAuthentication with bearer credential type', async () => {
		const ctx = mockCtx({
			http: vi.fn(async () => ({ entities: [] })),
		});
		const res = await cervioApiRequest.call(
			ctx as never,
			'GET',
			'/api/v1/entities',
		);
		expect(res).toEqual({ entities: [] });
		expect(ctx._http).toHaveBeenCalledWith(
			'cervioApi',
			expect.objectContaining({
				method: 'GET',
				url: 'https://acme.cervio.app/api/v1/entities',
				json: true,
			}),
		);
	});

	it('wraps transport errors as NodeApiError', async () => {
		const ctx = mockCtx({
			http: vi.fn(async () => {
				throw { status: 401, message: 'unauthorized' };
			}),
		});
		await expect(
			cervioApiRequest.call(ctx as never, 'GET', '/api/v1/me'),
		).rejects.toBeInstanceOf(NodeApiError);
	});

	it('rejects metadata base URLs before calling HTTP', async () => {
		const ctx = mockCtx({ baseUrl: 'http://169.254.169.254' });
		await expect(
			cervioApiRequest.call(ctx as never, 'GET', '/api/v1/me'),
		).rejects.toBeInstanceOf(NodeApiError);
		expect(ctx._http).not.toHaveBeenCalled();
	});
});

describe('record helpers', () => {
	it('getRecord and createRecord hit the expected paths', async () => {
		const http = vi
			.fn()
			.mockResolvedValueOnce({ id: 'r1', data: { nome: 'Ada' } })
			.mockResolvedValueOnce({ id: 'r2' });
		const ctx = mockCtx({ http });

		await getRecord.call(ctx as never, 'ent', 'r1');
		await createRecord.call(ctx as never, 'ent', 'default', { nome: 'Ada' });

		expect(http.mock.calls[0][1].url).toContain('/api/v1/entities/ent/records/r1');
		expect(http.mock.calls[1][1].method).toBe('POST');
		expect(http.mock.calls[1][1].url).toContain('/api/v1/entities/ent/records');
		expect(http.mock.calls[1][1].body).toMatchObject({
			form_name: 'default',
			data: { nome: 'Ada' },
		});
	});
});
