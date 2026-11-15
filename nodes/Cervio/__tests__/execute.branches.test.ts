/** Remaining input checks and options of each operation, through executeCervio. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		openRecordDocument: vi.fn(async () => ({ signed_url: 'https://x' })),
		generateRecordDocument: vi.fn(async () => ({ document_id: 'd1' })),
		uploadRecordDocument: vi.fn(async () => ({ document_id: 'd1' })),
		resolveNaturalKeys: vi.fn(),
		getWorkflowRunStatus: vi.fn(async () => ({ status: 'done' })),
		startWorkflowRun: vi.fn(async () => ({ invocation_id: 'inv' })),
		listEntityRecords: vi.fn(async () => []),
		listViewRecords: vi.fn(async () => ({ page: { has_more: false } })),
		linkThroughRecords: vi.fn(async () => ({ junction_record_id: 'row' })),
		searchRelationOptions: vi.fn(),
		notifySelf: vi.fn(async () => ({ ok: true })),
		notifyUsers: vi.fn(async () => ({ ok: true })),
	};
});

import {
	generateRecordDocument,
	getWorkflowRunStatus,
	listEntityRecords,
	notifySelf,
	openRecordDocument,
	resolveNaturalKeys,
	startWorkflowRun,
	uploadRecordDocument,
} from '../GenericFunctions';
import { NodeApiError } from 'n8n-workflow';

import type { IExecuteFunctions } from 'n8n-workflow';

import { executeCervio } from '../execute';

function run(params: Record<string, unknown>, item: Record<string, unknown> = { json: {} }) {
	const ctx = {
		getInputData: () => [item],
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({ name: 'Cervio' }),
		continueOnFail: () => false,
		helpers: { getBinaryDataBuffer: vi.fn(async () => Buffer.from('x')) },
	} as unknown as IExecuteFunctions;
	return executeCervio.call(ctx);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('operation selection', () => {
	it('infers the resource from the operation when it is missing', async () => {
		const [[item]] = await run({
			operation: 'getWorkflowRun',
			workflowId: 'wf',
			runId: 'run',
		});
		expect(item.json).toEqual({ status: 'done' });
	});

	it('rejects an unknown operation', async () => {
		await expect(run({ operation: 'explode', resource: 'record' })).rejects.toThrow(
			'Unsupported operation: explode',
		);
	});

	it('wraps a non-Error failure as a node error', async () => {
		vi.mocked(getWorkflowRunStatus).mockRejectedValueOnce('down');
		await expect(
			run({ operation: 'getWorkflowRun', workflowId: 'wf', runId: 'run' }),
		).rejects.toThrow('down');
	});

	it('keeps a non-Error failure readable with Continue On Fail', async () => {
		vi.mocked(getWorkflowRunStatus).mockRejectedValueOnce('down');
		const ctx = {
			getInputData: () => [{ json: {} }],
			getNodeParameter: (name: string) =>
				({ operation: 'getWorkflowRun', workflowId: 'wf', runId: 'run' })[name],
			getNode: () => ({ name: 'Cervio' }),
			continueOnFail: () => true,
		} as unknown as IExecuteFunctions;
		expect(await executeCervio.call(ctx)).toEqual([
			[{ json: { error: 'down' }, pairedItem: { item: 0 } }],
		]);
	});
});

describe('API errors', () => {
	it('tags an API error with the failing item, unless it already names one', async () => {
		const api = (itemIndex?: number) =>
			new NodeApiError(
				{ name: 'Cervio' } as never,
				{ message: 'x' },
				itemIndex === undefined ? {} : { itemIndex },
			);
		vi.mocked(getWorkflowRunStatus).mockRejectedValueOnce(api());
		const first = await run({ operation: 'getWorkflowRun', workflowId: 'wf', runId: 'run' }).catch(
			(e) => e,
		);
		expect(first.context.itemIndex).toBe(0);
		vi.mocked(getWorkflowRunStatus).mockRejectedValueOnce(api(4));
		const second = await run({ operation: 'getWorkflowRun', workflowId: 'wf', runId: 'run' }).catch(
			(e) => e,
		);
		expect(second.context.itemIndex).toBe(4);
	});
});

describe('documents', () => {
	const base = { resource: 'document', entityId: 'ent', recordId: 'rec' };

	it('opens a document', async () => {
		const [[item]] = await run({ ...base, operation: 'openDocument', documentId: ' d1 ' });
		expect(openRecordDocument).toHaveBeenCalledWith('ent', 'rec', 'd1');
		expect(item.json).toEqual({ signed_url: 'https://x' });
	});

	it('generates a document from a template', async () => {
		await run({ ...base, operation: 'generateDocument', templateId: 'tpl' });
		expect(generateRecordDocument).toHaveBeenCalledWith('ent', 'rec', 'tpl');
	});

	it('requires the document and template IDs', async () => {
		await expect(run({ ...base, operation: 'openDocument', documentId: '' })).rejects.toThrow(
			'Document ID is required.',
		);
		await expect(run({ ...base, operation: 'generateDocument' })).rejects.toThrow(
			'Template ID is required.',
		);
	});

	it('uploads with default binary field, file name and type', async () => {
		await run(
			{ ...base, operation: 'uploadDocument', binaryPropertyName: ' ' },
			{ json: {}, binary: { data: {} } },
		);
		const form = vi.mocked(uploadRecordDocument).mock.calls[0][2];
		const file = form.get('file') as File;
		expect([file.name, file.type, form.get('file_name'), form.get('title')]).toEqual([
			'upload.bin',
			'application/octet-stream',
			'upload.bin',
			null,
		]);
	});

	it('uploads with a file name chosen in the options', async () => {
		await run(
			{ ...base, operation: 'uploadDocument', uploadOptions: { fileName: 'contratto.pdf' } },
			{ json: {} },
		);
		expect(vi.mocked(uploadRecordDocument).mock.calls[0][2].get('file_name')).toBe('contratto.pdf');
	});
});

describe('relations', () => {
	const base = {
		resource: 'relation',
		operation: 'resolveRelation',
		entityId: 'ent',
		matchField: 'codice',
	};

	it('returns one item per resolved value', async () => {
		vi.mocked(resolveNaturalKeys).mockResolvedValue({
			results: [
				{ value: 'A1', record_id: 'r1' },
				{ value: 'B2', error: 'not_found' },
			],
		});
		const [out] = await run({
			...base,
			resolveValues: '["A1", "B2", ""]',
			resolveOptions: { fieldName: ' cliente_id ' },
		});
		expect(resolveNaturalKeys).toHaveBeenCalledWith('ent', 'codice', ['A1', 'B2'], 'cliente_id');
		expect(out.map((o) => o.json)).toEqual([
			{ value: 'A1', record_id: 'r1' },
			{ value: 'B2', error: 'not_found' },
		]);
	});

	it('accepts comma-separated values and a single result', async () => {
		vi.mocked(resolveNaturalKeys).mockResolvedValue({ value: 'A1', record_id: 'r1' });
		const [out] = await run({ ...base, resolveValues: ' A1, ,B2 ' });
		expect(resolveNaturalKeys).toHaveBeenCalledWith('ent', 'codice', ['A1', 'B2'], undefined);
		expect(out.map((o) => o.json)).toEqual([{ value: 'A1', record_id: 'r1' }]);
	});

	it.each([
		['', 'Values to resolve are required.'],
		['[oops', 'Values to resolve must be a JSON array or a comma-separated list.'],
		['["a"', 'Values to resolve must be a JSON array or a comma-separated list.'],
	])('rejects values %j', async (resolveValues, message) => {
		await expect(run({ ...base, resolveValues })).rejects.toThrow(message);
	});

	it('searches relation candidates with the default limit', async () => {
		const { searchRelationOptions } = await import('../GenericFunctions');
		const spy = vi.mocked(searchRelationOptions);
		spy.mockResolvedValue([]);
		await run({
			resource: 'relation',
			operation: 'searchRelation',
			entityId: 'ent',
			formName: 'default',
			relationFieldName: 'cliente_id',
			relationLimit: 'x',
		});
		expect(spy).toHaveBeenCalledWith('ent', 'default', 'cliente_id', 50, undefined);
	});
});

describe('lists', () => {
	it('sends equality filters and skips rows without a field', async () => {
		await run({
			resource: 'record',
			operation: 'listRecords',
			entityId: 'ent',
			listRecordsLimit: 0,
			listRecordsOffset: -5,
			listRecordsFilters: { filter: { field: ' stato ', value: ' attivo ' } },
		});
		await run({
			resource: 'record',
			operation: 'listRecords',
			entityId: 'ent',
			listRecordsFilters: { filter: [{ field: '', value: 'x' }, { field: 'codice' }] },
		});
		expect(vi.mocked(listEntityRecords).mock.calls.map((c) => c[1])).toEqual([
			{ limit: 50, offset: 0, 'filter[stato]': 'eq.attivo' },
			{ limit: 50, offset: 0, 'filter[codice]': 'eq.' },
		]);
	});
});

describe('list view and links', () => {
	it('passes the label locale and copes with a page without records', async () => {
		const { listViewRecords } = await import('../GenericFunctions');
		const [out] = await run({
			resource: 'record',
			operation: 'listView',
			viewId: 'view',
			pageMode: 'first',
			locale: 'it',
		});
		expect(out).toEqual([]);
		expect(vi.mocked(listViewRecords).mock.calls[0][1]).toMatchObject({ locale: 'it', limit: 50 });
	});

	it('links without link fields', async () => {
		const [[item]] = await run({
			resource: 'relation',
			operation: 'linkRecords',
			entityId: 'ent',
			formName: 'default',
			throughFieldName: 'progetti',
			recordId: 'rec',
			farRecordId: 'far',
		});
		expect(item.json).toEqual({
			junction_record_id: 'row',
			record_id: 'rec',
			far_record_id: 'far',
		});
	});
});

describe('workflows', () => {
	it('starts a workflow with key/value data', async () => {
		await run({
			resource: 'workflow',
			operation: 'startWorkflow',
			workflowId: 'wf',
			entityDataId: 'rec',
			workflowData: { values: [{ value: '' }, { name: 'motivo', value: 'test' }] },
		});
		expect(startWorkflowRun).toHaveBeenCalledWith('wf', 'rec', { motivo: 'test' });
	});

	it('requires the record and the run ID', async () => {
		await expect(
			run({ resource: 'workflow', operation: 'startWorkflow', workflowId: 'wf' }),
		).rejects.toThrow('Record ID (entity_data_id) is required.');
		await expect(
			run({ resource: 'workflow', operation: 'getWorkflowRun', workflowId: 'wf', runId: ' ' }),
		).rejects.toThrow('Run ID is required.');
	});
});

describe('notifications', () => {
	const base = { resource: 'notification', notificationTitle: 'Ciao' };

	it('sends all optional fields to the token owner', async () => {
		await run({
			...base,
			operation: 'notifySelf',
			notificationBody: ' Testo ',
			notificationHref: '/my-tasks',
			notificationCategory: 'task',
			notificationSourceType: 'n8n',
			notificationSourceId: 'run-1',
		});
		expect(notifySelf).toHaveBeenCalledWith({
			title: 'Ciao',
			body: 'Testo',
			href: '/my-tasks',
			category: 'task',
			source_type: 'n8n',
			source_id: 'run-1',
		});
	});

	it('defaults the category', async () => {
		await run({ ...base, operation: 'notifySelf', notificationCategory: ' ' });
		expect(notifySelf).toHaveBeenCalledWith({ title: 'Ciao', category: 'plugin' });
	});

	it.each([
		[{ notificationTitle: ' ' }, 'Title is required.'],
		[{ notificationTitle: 'x'.repeat(201) }, 'Title must be at most 200 characters.'],
	])('checks the title %#', async (title, message) => {
		await expect(run({ ...base, ...title, operation: 'notifySelf' })).rejects.toThrow(message);
	});

	it.each([
		[{}, 'Add at least one user ID.'],
		[{ user: [null, {}] }, 'Add at least one user ID.'],
		[
			{
				user: Array.from({ length: 51 }, (_, i) => ({
					id: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`,
				})),
			},
			'At most 50 users per notification.',
		],
	])('checks the recipients %#', async (notificationUserIds, message) => {
		await expect(run({ ...base, operation: 'notifyUsers', notificationUserIds })).rejects.toThrow(
			message,
		);
	});
});
