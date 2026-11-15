import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		linkThroughRecords: vi.fn(async () => ({ junction_record_id: 'row-1' })),
		unlinkThroughRecord: vi.fn(async () => ({ deleted: 1 })),
		listEntityRecords: vi.fn(async (_entityId: string) => [{ id: 'r1', data: { nome: 'Ada' } }]),
		listViewRecords: vi.fn(),
		countViewRecords: vi.fn(async () => 7),
		searchRelationOptions: vi.fn(async () => [{ id: 'c1', label: 'Cliente 1' }]),
		listRecordDocuments: vi.fn(async () => []),
		uploadRecordDocument: vi.fn(async () => ({ id: 'doc-1' })),
		startWorkflowRun: vi.fn(async () => ({ invocation_id: 'inv-1' })),
		notifyUsers: vi.fn(async () => ({ sent: 2 })),
	};
});

import {
	linkThroughRecords,
	listEntityRecords,
	listViewRecords,
	notifyUsers,
	searchRelationOptions,
	startWorkflowRun,
	unlinkThroughRecord,
	uploadRecordDocument,
} from '../GenericFunctions';
import type { IExecuteFunctions } from 'n8n-workflow';

import { executeCervio } from '../execute';

type Params = Record<string, unknown | ((itemIndex: number) => unknown)>;

function mockExecute(
	params: Params,
	opts: { items?: number; continueOnFail?: boolean; binary?: Record<string, unknown> } = {},
) {
	const items = Array.from({ length: opts.items ?? 1 }, (_, i) => ({
		json: { n: i },
		...(opts.binary ? { binary: opts.binary } : {}),
	}));
	const ctx = {
		getInputData: () => items,
		getNodeParameter: (name: string, i: number, fallback?: unknown) => {
			if (!(name in params)) return fallback;
			const v = params[name];
			return typeof v === 'function' ? (v as (i: number) => unknown)(i) : v;
		},
		getNode: () => ({ name: 'Cervio', typeVersion: 2 }),
		continueOnFail: () => opts.continueOnFail ?? false,
		helpers: { getBinaryDataBuffer: vi.fn(async () => Buffer.from('pdf')) },
	};
	return ctx as unknown as IExecuteFunctions;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('Link / Unlink Records', () => {
	it('links with junction fields and returns the row id', async () => {
		const ctx = mockExecute({
			resource: 'relation',
			operation: 'linkRecords',
			entityId: 'ent',
			formName: 'default',
			throughFieldName: 'progetti',
			recordId: ' rec ',
			farRecordId: 'far',
			'junctionFields.value': { anno: 2026, ore: '', note: null },
		});
		const [[item]] = await executeCervio.call(ctx);
		expect(linkThroughRecords).toHaveBeenCalledWith('ent', 'default', 'progetti', 'rec', 'far', {
			anno: 2026,
		});
		expect(item).toEqual({
			json: {
				junction_record_id: 'row-1',
				record_id: 'rec',
				far_record_id: 'far',
				data: { anno: 2026 },
			},
			pairedItem: { item: 0 },
		});
	});

	it('requires the far record', async () => {
		const ctx = mockExecute({
			resource: 'relation',
			operation: 'linkRecords',
			entityId: 'ent',
			formName: 'default',
			throughFieldName: 'progetti',
			recordId: 'rec',
			farRecordId: '  ',
		});
		await expect(executeCervio.call(ctx)).rejects.toThrow(/Far record ID is required/);
		expect(linkThroughRecords).not.toHaveBeenCalled();
	});

	it('unlinks one row by id', async () => {
		const ctx = mockExecute({
			resource: 'relation',
			operation: 'unlinkRecords',
			entityId: 'ent',
			formName: 'default',
			throughFieldName: 'progetti',
			recordId: 'rec',
			junctionRecordId: 'row-1',
		});
		const [[item]] = await executeCervio.call(ctx);
		expect(unlinkThroughRecord).toHaveBeenCalledWith('ent', 'default', 'progetti', 'rec', 'row-1');
		expect(item.json).toEqual({ deleted: 1, junction_record_id: 'row-1', record_id: 'rec' });
	});
});

describe('per-item execution', () => {
	it('runs list operations once per input item, with that item’s parameters', async () => {
		const ctx = mockExecute(
			{ resource: 'record', operation: 'listRecords', entityId: (i: number) => `ent-${i}` },
			{ items: 2 },
		);
		const [out] = await executeCervio.call(ctx);
		expect(vi.mocked(listEntityRecords).mock.calls.map((c) => c[0])).toEqual(['ent-0', 'ent-1']);
		expect(out.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(out[0].json).toEqual({ id: 'r1', nome: 'Ada' });
	});

	it('runs Search Relation per item', async () => {
		const ctx = mockExecute(
			{
				resource: 'relation',
				operation: 'searchRelation',
				entityId: 'ent',
				formName: 'default',
				relationFieldName: 'cliente_id',
				relationQuery: (i: number) => `q${i}`,
				relationLimit: 500,
			},
			{ items: 2 },
		);
		const [out] = await executeCervio.call(ctx);
		expect(vi.mocked(searchRelationOptions).mock.calls.map((c) => [c[3], c[4]])).toEqual([
			[100, 'q0'],
			[100, 'q1'],
		]);
		expect(out[1]).toEqual({
			json: { id: 'c1', label: 'Cliente 1', field: 'cliente_id' },
			pairedItem: { item: 1 },
		});
	});

	it('turns a failed item into { error } with Continue On Fail and keeps going', async () => {
		vi.mocked(unlinkThroughRecord).mockRejectedValueOnce(new Error('boom'));
		const ctx = mockExecute(
			{
				resource: 'relation',
				operation: 'unlinkRecords',
				entityId: 'ent',
				formName: 'default',
				throughFieldName: 'progetti',
				recordId: 'rec',
				junctionRecordId: (i: number) => `row-${i}`,
			},
			{ items: 2, continueOnFail: true },
		);
		const [out] = await executeCervio.call(ctx);
		expect(out).toEqual([
			{ json: { error: 'boom' }, pairedItem: { item: 0 } },
			{
				json: { deleted: 1, junction_record_id: 'row-1', record_id: 'rec' },
				pairedItem: { item: 1 },
			},
		]);
	});

	it('reports which item failed', async () => {
		vi.mocked(unlinkThroughRecord)
			.mockResolvedValueOnce({ deleted: 1 })
			.mockRejectedValueOnce(new Error('boom'));
		const ctx = mockExecute(
			{
				resource: 'relation',
				operation: 'unlinkRecords',
				entityId: 'ent',
				formName: 'default',
				throughFieldName: 'progetti',
				recordId: 'rec',
				junctionRecordId: 'row',
			},
			{ items: 2 },
		);
		const error = await executeCervio.call(ctx).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).context.itemIndex).toBe(1);
		expect((error as NodeOperationError).message).toBe('boom');
	});
});

describe('List View', () => {
	const page = (n: number, hasMore: boolean) => ({
		records: [{ id: `r${n}`, data: { n } }],
		page: { limit: 1, has_more: hasMore, next_cursor: hasMore ? `c${n}` : undefined },
	});
	const base = {
		resource: 'record',
		operation: 'listView',
		viewId: 'view',
		limit: 1,
		optionsMode: 'slugs',
		relationsMode: 'uuids',
	};

	it('first page exposes the next cursor and the count', async () => {
		vi.mocked(listViewRecords).mockResolvedValueOnce(page(1, true));
		const ctx = mockExecute({ ...base, pageMode: 'first', includeCount: true });
		const [[item]] = await executeCervio.call(ctx);
		expect(item.json).toEqual({
			id: 'r1',
			n: 1,
			_view_count: 7,
			_has_more: true,
			_next_cursor: 'c1',
		});
	});

	it('all pages follows cursors until has_more is false', async () => {
		vi.mocked(listViewRecords)
			.mockResolvedValueOnce(page(1, true))
			.mockResolvedValueOnce(page(2, false));
		const ctx = mockExecute({ ...base, pageMode: 'all', listOptions: { cursor: 'start' } });
		const [out] = await executeCervio.call(ctx);
		expect(out.map((o) => o.json)).toEqual([
			{ id: 'r1', n: 1 },
			{ id: 'r2', n: 2 },
		]);
		expect(vi.mocked(listViewRecords).mock.calls.map((c) => c[1].cursor)).toEqual(['start', 'c1']);
	});

	it('all pages stops at the page cap and marks the output as truncated', async () => {
		vi.mocked(listViewRecords).mockImplementation(async () => page(9, true));
		const ctx = mockExecute({ ...base, pageMode: 'all' });
		const [out] = await executeCervio.call(ctx);
		expect(listViewRecords).toHaveBeenCalledTimes(10);
		expect(out.at(-1)?.json).toMatchObject({
			_truncated: true,
			_has_more: true,
			_next_cursor: 'c9',
		});
	});
});

describe('documents, workflows, notifications', () => {
	it('lists no items for a record without documents', async () => {
		const ctx = mockExecute({
			resource: 'document',
			operation: 'listDocuments',
			entityId: 'ent',
			recordId: 'rec',
		});
		expect(await executeCervio.call(ctx)).toEqual([[]]);
	});

	it('uploads the item binary with its file name and type', async () => {
		const ctx = mockExecute(
			{
				resource: 'document',
				operation: 'uploadDocument',
				entityId: 'ent',
				recordId: 'rec',
				binaryPropertyName: 'data',
				uploadOptions: { title: ' Contratto ' },
			},
			{ binary: { data: { fileName: 'c.pdf', mimeType: 'application/pdf' } } },
		);
		const [[item]] = await executeCervio.call(ctx);
		expect(item.json).toEqual({ id: 'doc-1' });
		const form = vi.mocked(uploadRecordDocument).mock.calls[0][2];
		expect((form.get('file') as File).name).toBe('c.pdf');
		expect((form.get('file') as File).type).toBe('application/pdf');
		expect(form.get('file_name')).toBe('c.pdf');
		expect(form.get('title')).toBe('Contratto');
	});

	it('starts a workflow with JSON data', async () => {
		const ctx = mockExecute({
			resource: 'workflow',
			operation: 'startWorkflow',
			workflowId: 'wf',
			entityDataId: 'rec',
			workflowDataMode: 'json',
			workflowDataJson: '{"a":1}',
		});
		const [[item]] = await executeCervio.call(ctx);
		expect(startWorkflowRun).toHaveBeenCalledWith('wf', 'rec', { a: 1 });
		expect(item.json).toEqual({ invocation_id: 'inv-1' });
	});

	it('notifies each user once', async () => {
		const u = '55555555-5555-4555-8555-555555555555';
		const ctx = mockExecute({
			resource: 'notification',
			operation: 'notifyUsers',
			notificationTitle: 'Ciao',
			notificationUserIds: { user: [{ id: u }, { id: ` ${u} ` }, { id: '' }] },
		});
		await executeCervio.call(ctx);
		expect(notifyUsers).toHaveBeenCalledWith([u], { title: 'Ciao', category: 'plugin' });
	});

	it('names the user IDs that are not valid instead of dropping them', async () => {
		const ctx = mockExecute({
			resource: 'notification',
			operation: 'notifyUsers',
			notificationTitle: 'Ciao',
			notificationUserIds: { user: { id: 'mario' } },
		});
		await expect(executeCervio.call(ctx)).rejects.toThrow('User IDs must be UUIDs: "mario".');
		expect(notifyUsers).not.toHaveBeenCalled();
	});
});
