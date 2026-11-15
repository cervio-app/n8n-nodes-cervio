/**
 * Every Cervio API helper: method, URL, body / query and how the response is unwrapped.
 * The table is the node's contract with Cervio's REST API (/api/v1).
 */
import { describe, expect, it, vi } from 'vitest';

import * as api from '../GenericFunctions';

const E = '11111111-1111-4111-8111-111111111111'; // entity
const R = '22222222-2222-4222-8222-222222222222'; // record
const V = '33333333-3333-4333-8333-333333333333'; // view
const D = '44444444-4444-4444-8444-444444444444'; // document
const W = '55555555-5555-4555-8555-555555555555'; // workflow / run
const T = '66666666-6666-4666-8666-666666666666'; // template
const BASE = 'https://acme.cervio.app';

function ctx(response: unknown) {
	const http = vi.fn(async () => response);
	return {
		http,
		ctx: {
			getCredentials: async () => ({ baseUrl: BASE, apiKey: 'cpat_x' }),
			getNode: () => ({ name: 'Cervio' }),
			helpers: { httpRequestWithAuthentication: http },
		} as never,
	};
}

type Case = {
	name: string;
	call: (c: never) => Promise<unknown>;
	response: unknown;
	method: string;
	path: string;
	body?: unknown;
	qs?: unknown;
	returns: unknown;
};

const cases: Case[] = [
	{
		name: 'listEntities',
		call: (c) => api.listEntities.call(c),
		response: { entities: [{ id: E }] },
		method: 'GET',
		path: '/api/v1/entities',
		returns: [{ id: E }],
	},
	{
		name: 'listEntities (empty)',
		call: (c) => api.listEntities.call(c),
		response: {},
		method: 'GET',
		path: '/api/v1/entities',
		returns: [],
	},
	{
		name: 'listForms',
		call: (c) => api.listForms.call(c, E),
		response: { forms: [{ name: 'default' }] },
		method: 'GET',
		path: `/api/v1/admin/entities/${E}/forms`,
		returns: [{ name: 'default' }],
	},
	{
		name: 'listForms (empty)',
		call: (c) => api.listForms.call(c, E),
		response: {},
		method: 'GET',
		path: `/api/v1/admin/entities/${E}/forms`,
		returns: [],
	},
	{
		name: 'listViews',
		call: (c) => api.listViews.call(c, E),
		response: { views: [{ id: V }] },
		method: 'GET',
		path: `/api/v1/admin/entities/${E}/views`,
		returns: [{ id: V }],
	},
	{
		name: 'listViews (empty)',
		call: (c) => api.listViews.call(c, E),
		response: {},
		method: 'GET',
		path: `/api/v1/admin/entities/${E}/views`,
		returns: [],
	},
	{
		name: 'getWriteSchema',
		call: (c) => api.getWriteSchema.call(c, E, 'my form'),
		response: { fields: [] },
		method: 'GET',
		path: `/api/v1/entities/${E}/forms/my%20form/write-schema`,
		returns: { fields: [] },
	},
	{
		name: 'searchRelationOptions',
		call: (c) => api.searchRelationOptions.call(c, E, 'default', 'cliente_id', 500, ' acme '),
		response: { records: [{ id: R, label: 'Acme' }, { id: V }] },
		method: 'GET',
		path: `/api/v1/entities/${E}/forms/default/fields/cliente_id/relation-options`,
		qs: { limit: 100, q: 'acme' },
		returns: [
			{ id: R, label: 'Acme' },
			{ id: V, label: V },
		],
	},
	{
		name: 'searchRelationOptions (defaults)',
		call: (c) => api.searchRelationOptions.call(c, E, 'default', 'cliente_id', Number.NaN),
		response: {},
		method: 'GET',
		path: `/api/v1/entities/${E}/forms/default/fields/cliente_id/relation-options`,
		qs: { limit: 50 },
		returns: [],
	},
	{
		name: 'createRecord',
		call: (c) => api.createRecord.call(c, E, 'default', { nome: 'Ada' }),
		response: { id: R },
		method: 'POST',
		path: `/api/v1/entities/${E}/records`,
		body: { form_name: 'default', data: { nome: 'Ada' } },
		returns: { id: R },
	},
	{
		name: 'updateRecord',
		call: (c) =>
			api.updateRecord.call(c, E, R, 'default', { nome: 'Ada' }, '2026-11-01T10:00:00Z', {
				tag: 'add',
			}),
		response: { id: R },
		method: 'PATCH',
		path: `/api/v1/entities/${E}/records/${R}`,
		body: {
			form_name: 'default',
			data: { nome: 'Ada' },
			expected_updated_at: '2026-11-01T10:00:00Z',
			multi_value_modes: { tag: 'add' },
		},
		returns: { id: R },
	},
	{
		name: 'updateRecord (plain)',
		call: (c) => api.updateRecord.call(c, E, R, 'default', { nome: 'Ada' }, undefined, {}),
		response: { id: R },
		method: 'PATCH',
		path: `/api/v1/entities/${E}/records/${R}`,
		body: { form_name: 'default', data: { nome: 'Ada' } },
		returns: { id: R },
	},
	{
		name: 'listViewRecords',
		call: (c) => api.listViewRecords.call(c, V, { limit: 5 }),
		response: { records: [] },
		method: 'GET',
		path: `/api/v1/views/${V}/records`,
		qs: { limit: 5 },
		returns: { records: [] },
	},
	{
		name: 'countViewRecords',
		call: (c) => api.countViewRecords.call(c, V),
		response: { count: 7 },
		method: 'GET',
		path: `/api/v1/views/${V}/records/count`,
		returns: 7,
	},
	{
		name: 'countViewRecords (missing)',
		call: (c) => api.countViewRecords.call(c, V),
		response: {},
		method: 'GET',
		path: `/api/v1/views/${V}/records/count`,
		returns: 0,
	},
	{
		name: 'listWorkflows',
		call: (c) => api.listWorkflows.call(c),
		response: { workflows: [{ id: W }] },
		method: 'GET',
		path: '/api/v1/admin/workflows',
		returns: [{ id: W }],
	},
	{
		name: 'listWorkflows (empty)',
		call: (c) => api.listWorkflows.call(c),
		response: {},
		method: 'GET',
		path: '/api/v1/admin/workflows',
		returns: [],
	},
	{
		name: 'getRecord',
		call: (c) => api.getRecord.call(c, E, R),
		response: { record: { id: R } },
		method: 'GET',
		path: `/api/v1/entities/${E}/records/${R}`,
		returns: { id: R },
	},
	{
		name: 'deleteRecord',
		call: (c) => api.deleteRecord.call(c, E, R),
		response: { ok: true },
		method: 'DELETE',
		path: `/api/v1/entities/${E}/records/${R}`,
		returns: { ok: true },
	},
	{
		name: 'listEntityRecords',
		call: (c) => api.listEntityRecords.call(c, E, { limit: 5 }),
		response: { records: [{ id: R }] },
		method: 'GET',
		path: `/api/v1/entities/${E}/records`,
		qs: { limit: 5 },
		returns: [{ id: R }],
	},
	{
		name: 'listEntityRecords (empty)',
		call: (c) => api.listEntityRecords.call(c, E, {}),
		response: {},
		method: 'GET',
		path: `/api/v1/entities/${E}/records`,
		qs: {},
		returns: [],
	},
	{
		name: 'validateDraft',
		call: (c) => api.validateDraft.call(c, E, 'default', { nome: 'Ada' }, R),
		response: { ok: true },
		method: 'POST',
		path: `/api/v1/entities/${E}/forms/default/validate-draft`,
		body: { data: { nome: 'Ada' }, record_id: R },
		returns: { ok: true },
	},
	{
		name: 'validateDraft (new record)',
		call: (c) => api.validateDraft.call(c, E, 'default', {}),
		response: { ok: true },
		method: 'POST',
		path: `/api/v1/entities/${E}/forms/default/validate-draft`,
		body: { data: {} },
		returns: { ok: true },
	},
	{
		name: 'upsertRecord',
		call: (c) => api.upsertRecord.call(c, E, 'default', 'codice', { codice: 'A1' }),
		response: { id: R, action: 'created' },
		method: 'POST',
		path: `/api/v1/entities/${E}/records/upsert`,
		body: { form_name: 'default', match_field: 'codice', data: { codice: 'A1' } },
		returns: { id: R, action: 'created' },
	},
	{
		name: 'listRecordDocuments',
		call: (c) => api.listRecordDocuments.call(c, E, R),
		response: { documents: [{ document_id: D }] },
		method: 'GET',
		path: `/api/v1/entities/${E}/records/${R}/documents`,
		returns: [{ document_id: D }],
	},
	{
		name: 'listRecordDocuments (empty)',
		call: (c) => api.listRecordDocuments.call(c, E, R),
		response: {},
		method: 'GET',
		path: `/api/v1/entities/${E}/records/${R}/documents`,
		returns: [],
	},
	{
		name: 'openRecordDocument',
		call: (c) => api.openRecordDocument.call(c, E, R, D),
		response: { signed_url: 'u' },
		method: 'GET',
		path: `/api/v1/entities/${E}/records/${R}/documents/${D}/open`,
		returns: { signed_url: 'u' },
	},
	{
		name: 'generateRecordDocument',
		call: (c) => api.generateRecordDocument.call(c, E, R, T),
		response: { document_id: D },
		method: 'POST',
		path: `/api/v1/entities/${E}/records/${R}/documents/generate`,
		body: { template_id: T },
		returns: { document_id: D },
	},
	{
		name: 'resolveNaturalKeys',
		call: (c) => api.resolveNaturalKeys.call(c, E, 'codice', ['A1'], 'cliente_id'),
		response: { results: [] },
		method: 'POST',
		path: `/api/v1/entities/${E}/resolve`,
		body: { match_field: 'codice', values: ['A1'], field_name: 'cliente_id' },
		returns: { results: [] },
	},
	{
		name: 'resolveNaturalKeys (this entity)',
		call: (c) => api.resolveNaturalKeys.call(c, E, 'codice', ['A1']),
		response: { results: [] },
		method: 'POST',
		path: `/api/v1/entities/${E}/resolve`,
		body: { match_field: 'codice', values: ['A1'] },
		returns: { results: [] },
	},
	{
		name: 'startWorkflowRun',
		call: (c) => api.startWorkflowRun.call(c, W, R, { a: 1 }),
		response: { invocation_id: W },
		method: 'POST',
		path: `/api/v1/workflows/${W}/runs`,
		body: { entity_data_id: R, data: { a: 1 } },
		returns: { invocation_id: W },
	},
	{
		name: 'startWorkflowRun (no data)',
		call: (c) => api.startWorkflowRun.call(c, W, R, {}),
		response: { invocation_id: W },
		method: 'POST',
		path: `/api/v1/workflows/${W}/runs`,
		body: { entity_data_id: R },
		returns: { invocation_id: W },
	},
	{
		name: 'getWorkflowRunStatus',
		call: (c) => api.getWorkflowRunStatus.call(c, W, W),
		response: { status: 'done' },
		method: 'GET',
		path: `/api/v1/admin/workflows/${W}/runs/${W}`,
		returns: { status: 'done' },
	},
	{
		name: 'notifySelf',
		call: (c) => api.notifySelf.call(c, { title: 'Ciao' }),
		response: { ok: true },
		method: 'POST',
		path: '/api/v1/me/notifications',
		body: { title: 'Ciao' },
		returns: { ok: true },
	},
	{
		name: 'notifyUsers',
		call: (c) => api.notifyUsers.call(c, [W], { title: 'Ciao' }),
		response: { ok: true },
		method: 'POST',
		path: '/api/v1/notifications',
		body: { user_ids: [W], title: 'Ciao' },
		returns: { ok: true },
	},
];

describe('Cervio API helpers', () => {
	it.each(cases)('$name', async ({ call, response, method, path, body, qs, returns }) => {
		const { ctx: c, http } = ctx(response);
		expect(await call(c)).toEqual(returns);
		const request = (http.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
		expect(request.method).toBe(method);
		expect(request.url).toBe(`${BASE}${path}`);
		expect(request.json).toBe(true);
		expect(request.headers).toEqual({ Accept: 'application/json' });
		expect(request.body).toEqual(body);
		expect(request.qs).toEqual(qs ?? {});
	});

	it('uploads a document as multipart', async () => {
		const { ctx: c, http } = ctx({ document_id: D });
		const form = new FormData();
		expect(await api.uploadRecordDocument.call(c, E, R, form)).toEqual({ document_id: D });
		expect((http.mock.calls[0] as unknown[])[1]).toMatchObject({
			method: 'POST',
			url: `${BASE}/api/v1/entities/${E}/records/${R}/documents`,
			body: form,
			json: false,
		});
	});

	it('keeps a non-JSON multipart response as text', async () => {
		const { ctx: c } = ctx('OK');
		expect(await api.cervioApiRequestMultipart.call(c, 'POST', 'x', new FormData())).toBe('OK');
	});

	it('accepts a path without a leading slash', async () => {
		const { ctx: c, http } = ctx({});
		await api.cervioApiRequest.call(c, 'GET', 'api/v1/me');
		expect(((http.mock.calls[0] as unknown[])[1] as { url: string }).url).toBe(`${BASE}/api/v1/me`);
	});

	it('reports a missing Base URL as an API error', async () => {
		const c = {
			getCredentials: async () => ({}),
			getNode: () => ({ name: 'Cervio' }),
			helpers: { httpRequestWithAuthentication: vi.fn() },
		} as never;
		await expect(api.cervioApiRequest.call(c, 'GET', '/x')).rejects.toThrow(/Base URL is missing/);
	});
});
