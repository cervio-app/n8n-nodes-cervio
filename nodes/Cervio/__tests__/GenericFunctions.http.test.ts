import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeApiError } from 'n8n-workflow';

import {
	cervioApiRequest,
	cervioApiRequestMultipart,
	cervioErrorMessage,
	createRecord,
	getRecord,
	idSegment,
	linkThroughRecords,
	unlinkThroughRecord,
} from '../GenericFunctions';

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

	it('uses the Cervio error message instead of the generic HTTP text', async () => {
		const ctx = mockCtx({
			http: vi.fn(async () => {
				throw {
					message: 'Request failed with status code 400',
					response: {
						status: 400,
						data: { error: 'missing_required_fields', message: 'Missing required junction fields: anno' },
					},
				};
			}),
		});
		const error = await cervioApiRequest.call(ctx as never, 'POST', '/x', {}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Missing required junction fields: anno');
		expect((error as NodeApiError).httpCode).toBe('400');
	});

	it('falls back to the error code, then to n8n’s own message', () => {
		expect(cervioErrorMessage({ response: { data: { error: 'edit_lock_held' } } })).toBe('edit_lock_held');
		expect(cervioErrorMessage({ cause: { response: { data: { message: 'x' } } } })).toBe('x');
		expect(cervioErrorMessage({ response: { data: 'oops' } })).toBeUndefined();
		expect(cervioErrorMessage(null)).toBeUndefined();
	});

	it('rejects metadata base URLs before calling HTTP', async () => {
		const ctx = mockCtx({ baseUrl: 'http://169.254.169.254' });
		await expect(
			cervioApiRequest.call(ctx as never, 'GET', '/api/v1/me'),
		).rejects.toBeInstanceOf(NodeApiError);
		expect(ctx._http).not.toHaveBeenCalled();
	});
});

const ENTITY = '11111111-1111-4111-8111-111111111111';
const RECORD = '22222222-2222-4222-8222-222222222222';
const FAR = '33333333-3333-4333-8333-333333333333';
const ROW = '44444444-4444-4444-8444-444444444444';

describe('record helpers', () => {
	it('getRecord and createRecord hit the expected paths', async () => {
		const http = vi
			.fn()
			.mockResolvedValueOnce({ record: { id: RECORD, data: { nome: 'Ada' } } })
			.mockResolvedValueOnce({ id: RECORD });
		const ctx = mockCtx({ http });

		await getRecord.call(ctx as never, ENTITY, RECORD);
		await createRecord.call(ctx as never, ENTITY, 'default', { nome: 'Ada' });

		expect(http.mock.calls[0][1].url).toBe(
			`https://acme.cervio.app/api/v1/entities/${ENTITY}/records/${RECORD}`,
		);
		expect(http.mock.calls[1][1].method).toBe('POST');
		expect(http.mock.calls[1][1].url).toBe(`https://acme.cervio.app/api/v1/entities/${ENTITY}/records`);
		expect(http.mock.calls[1][1].body).toMatchObject({
			form_name: 'default',
			data: { nome: 'Ada' },
		});
	});

	it.each(['../admin', 'abc', '', `${RECORD}/../x`])(
		'never puts a non-UUID id (%j) in the URL',
		async (bad) => {
			const ctx = mockCtx();
			await expect(getRecord.call(ctx as never, ENTITY, bad)).rejects.toThrow(
				/Record ID must be a UUID/,
			);
			expect(ctx._http).not.toHaveBeenCalled();
		},
	);

	it('trims ids', () => {
		expect(idSegment(` ${RECORD} `, 'Record ID')).toBe(RECORD);
	});
});

describe('N:M links', () => {
	const linksUrl = `https://acme.cervio.app/api/v1/entities/${ENTITY}/forms/my%20form/fields/progetti/links`;

	it('Link creates one junction row with its fields', async () => {
		const http = vi.fn(async () => ({ junction_record_id: ROW }));
		const ctx = mockCtx({ http });
		const res = await linkThroughRecords.call(ctx as never, ENTITY, 'my form', 'progetti', RECORD, FAR, {
			anno: 2026,
		});
		expect(res).toEqual({ junction_record_id: ROW });
		expect(http).toHaveBeenCalledWith(
			'cervioApi',
			expect.objectContaining({
				method: 'POST',
				url: linksUrl,
				body: { from_record_id: RECORD, far_record_id: FAR, data: { anno: 2026 } },
			}),
		);
	});

	it('Link omits data when there are no junction fields', async () => {
		const http = vi.fn(async () => ({ junction_record_id: ROW }));
		await linkThroughRecords.call(mockCtx({ http }) as never, ENTITY, 'my form', 'progetti', RECORD, FAR, {});
		expect(http.mock.calls[0][1].body).toEqual({ from_record_id: RECORD, far_record_id: FAR });
	});

	it('Unlink removes one junction row by id', async () => {
		const http = vi.fn(async () => ({ deleted: 1 }));
		const res = await unlinkThroughRecord.call(mockCtx({ http }) as never, ENTITY, 'my form', 'progetti', RECORD, ROW);
		expect(res).toEqual({ deleted: 1 });
		expect(http).toHaveBeenCalledWith(
			'cervioApi',
			expect.objectContaining({
				method: 'DELETE',
				url: linksUrl,
				body: { from_record_id: RECORD, junction_record_id: ROW },
			}),
		);
	});

	it('Unlink rejects a junction row id that is not a UUID', async () => {
		const ctx = mockCtx();
		await expect(
			unlinkThroughRecord.call(ctx as never, ENTITY, 'f', 'progetti', RECORD, 'row-1'),
		).rejects.toThrow(/Junction Record ID must be a UUID/);
		expect(ctx._http).not.toHaveBeenCalled();
	});
});

describe('multipart', () => {
	it('parses a JSON string response', async () => {
		const http = vi.fn(async () => '{"id":"d1"}');
		const res = await cervioApiRequestMultipart.call(mockCtx({ http }) as never, 'POST', '/x', new FormData());
		expect(res).toEqual({ id: 'd1' });
		expect(http.mock.calls[0][1]).toMatchObject({ json: false, url: 'https://acme.cervio.app/x' });
	});
});
