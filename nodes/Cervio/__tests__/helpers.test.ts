/** Edge cases of the pure helpers: parameter parsing, workflow data, API errors, field mapping. */
import { describe, expect, it, vi } from 'vitest';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { IExecuteFunctions } from 'n8n-workflow';

import { cervioErrorMessage, flattenRecordRow, idSegment } from '../GenericFunctions';
import { cervioApiCredentialTest } from '../methods/credentialTest';
import {
	parseMultiValueModes,
	parseResolveValues,
	readJunctionFieldData,
	readMappedFieldData,
} from '../execute/parameters';
import { parseWorkflowDataPayload, resolveWorkflowStartData } from '../execute/workflowData';
import { mapValueShapeToMapperType, writeSchemaToMapperFields } from '../writeSchemaMapper';
import type { WriteDiscoveryField } from '../writeSchemaMapper';

const ctx = (params: Record<string, unknown> = {}) =>
	({
		getNode: () => ({ name: 'Cervio' }),
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
	}) as unknown as IExecuteFunctions;

describe('parameters', () => {
	it('reads mapped fields even when the mapper value is empty', () => {
		expect(
			readMappedFieldData(
				ctx({ 'fields.mappingMode': 'defineBelow', 'fields.value': null }),
				[],
				0,
			),
		).toEqual({});
		expect(readJunctionFieldData(ctx({ 'junctionFields.value': null }), 0)).toEqual({});
		expect(readJunctionFieldData(ctx(), 0)).toEqual({});
	});

	it('treats missing values to resolve as empty', () => {
		expect(() => parseResolveValues(ctx(), undefined as never, 0)).toThrow(
			'Values to resolve are required.',
		);
	});

	it('reads multi-select modes from one or several entries, ignoring incomplete ones', () => {
		expect(parseMultiValueModes(undefined)).toBeUndefined();
		expect(parseMultiValueModes('add')).toBeUndefined();
		expect(parseMultiValueModes({})).toBeUndefined();
		expect(parseMultiValueModes({ entry: { field: ' tag ', mode: 'remove' } })).toEqual({
			tag: 'remove',
		});
		expect(
			parseMultiValueModes({
				entry: [null, { mode: 'add' }, { field: 'a' }, { field: 'b', mode: 'replace' }],
			}),
		).toEqual({ b: 'replace' });
	});
});

describe('workflow data', () => {
	it.each([
		[undefined, undefined],
		['', undefined],
		['  ', undefined],
		['{}', undefined],
		['{"a":1}', { a: 1 }],
		[42, undefined],
		[{}, undefined],
		[{ a: 1 }, { a: 1 }],
		[{ values: { name: 'a', value: 'b' } }, { a: 'b' }],
		[{ values: [null, 'x', { name: ' ', value: '  ' }, { name: 'n', value: 0 }] }, { n: 0 }],
		[{ values: null }, undefined],
	])('reads %j', (raw, expected) => {
		expect(parseWorkflowDataPayload(ctx(), raw, 0)).toEqual(expected);
	});

	it('rejects invalid JSON, a value without a name and oversized data', () => {
		expect(() => parseWorkflowDataPayload(ctx(), '{oops', 0)).toThrow(
			'Invalid Additional Data: expected valid JSON object.',
		);
		expect(() =>
			parseWorkflowDataPayload(ctx(), { values: [{ name: '', value: 'x' }] }, 0),
		).toThrow('Each Additional Data row must have a name.');
		expect(() => parseWorkflowDataPayload(ctx(), { big: 'x'.repeat(70 * 1024) }, 0)).toThrow(
			/too large/,
		);
		expect(() =>
			parseWorkflowDataPayload(
				ctx(),
				{ values: [{ name: 'big', value: 'x'.repeat(70 * 1024) }] },
				0,
			),
		).toThrow(/too large/);
	});

	it('falls back to Key/Value mode and treats a missing JSON as no data', () => {
		expect(resolveWorkflowStartData(ctx({ workflowDataMode: '' }), 0)).toBeUndefined();
		expect(
			resolveWorkflowStartData(ctx({ workflowDataMode: 'json', workflowDataJson: null }), 0),
		).toBeUndefined();
		expect(() =>
			resolveWorkflowStartData(ctx({ workflowDataMode: 'json', workflowDataJson: 5 }), 0),
		).toThrow('Additional Data must be a JSON object.');
	});
});

describe('API helpers', () => {
	it('rejects a missing or non-string id', () => {
		expect(() => idSegment(undefined as never, 'Record ID')).toThrow(
			'Record ID must be a UUID, got "".',
		);
	});

	it('falls back to the error code when the message is blank', () => {
		expect(cervioErrorMessage({ response: { data: { message: ' ', error: 'conflict' } } })).toBe(
			'conflict',
		);
		expect(cervioErrorMessage({ response: { data: { error: ' ' } } })).toBeUndefined();
		expect(cervioErrorMessage({ error: { message: 'from request' } })).toBe('from request');
		expect(cervioErrorMessage({ context: { data: { message: 'from n8n' } } })).toBe('from n8n');
		expect(cervioErrorMessage({ reason: { response: { data: { message: 'from reason' } } } })).toBe(
			'from reason',
		);
	});

	it('flattens a row without an id', () => {
		expect(flattenRecordRow({ nome: 'Ada', created_at: 'x' })).toEqual({ nome: 'Ada' });
	});

	it('keeps an API error that already names its item', async () => {
		const error = new NodeApiError({ name: 'Cervio' } as never, { message: 'x' }, { itemIndex: 3 });
		expect(error.context.itemIndex).toBe(3);
		expect(
			new NodeOperationError({ name: 'Cervio' } as never, 'y').context.itemIndex,
		).toBeUndefined();
	});

	it('tests a credential without data', async () => {
		const res = await cervioApiCredentialTest.call(
			{ helpers: { request: vi.fn() } } as never,
			{ id: '1', name: 'c', type: 'cervioApi' } as never,
		);
		expect(res).toEqual({ status: 'Error', message: 'Cervio credential Base URL is missing' });
	});
});

describe('field mapping', () => {
	const field = (input: WriteDiscoveryField['input'], extra: Partial<WriteDiscoveryField> = {}) =>
		({
			name: 'f',
			label: '',
			field_type: 'text',
			value_shape: 'string',
			required: false,
			readonly: false,
			order: 0,
			instructions: null,
			input,
			...extra,
		}) as WriteDiscoveryField;

	it('maps a boolean value shape to a boolean column', () => {
		expect(mapValueShapeToMapperType(field({ mode: 'none' }, { value_shape: 'boolean' }))).toBe(
			'boolean',
		);
	});

	it('falls back to the field name as label', () => {
		const [column] = writeSchemaToMapperFields({
			form: { id: 'x', name: 'x', label: 'x' },
			fields: [field({ mode: 'remote_options' })],
		});
		expect(column).toMatchObject({ id: 'f', displayName: 'f', type: 'string' });
	});
});

describe('write values', () => {
	it.each([
		[[null, 'a', ''], ['a']],
		['{"id":"x"}', 'x'],
		['{abc', '{abc'],
		[
			{ id: null, label: 'x' },
			{ id: null, label: 'x' },
		],
		[{ id: 5 }, 5],
		[{ id: true }, true],
		[{ id: { nested: 1 } }, '[object Object]'],
	])('coerces %j', async (value, expected) => {
		const { coerceWriteValue } = await import('../writeSchemaMapper');
		expect(coerceWriteValue(value)).toEqual(expected);
	});

	it('drops empty lists and handles a missing payload', async () => {
		const { pickCompiledFieldValues } = await import('../writeSchemaMapper');
		expect(pickCompiledFieldValues(null)).toEqual({});
		expect(pickCompiledFieldValues({ tags: '[]', ok: false })).toEqual({ ok: false });
	});

	it('labels fixed options by value when they have no label', () => {
		const [column] = writeSchemaToMapperFields({
			form: { id: 'x', name: 'x', label: 'x' },
			fields: [
				{
					name: 'stato',
					label: 'Stato',
					field_type: 'select',
					value_shape: 'string',
					required: false,
					readonly: false,
					order: 0,
					instructions: null,
					input: { mode: 'fixed_list', options: [{ value: 'aperto', label: '' }] },
				},
			],
		});
		expect(column.options).toEqual([{ name: 'aperto', value: 'aperto' }]);
	});

	it('encodes a missing form name as empty', async () => {
		const http = vi.fn(async () => ({}));
		const { getWriteSchema } = await import('../GenericFunctions');
		await getWriteSchema.call(
			{
				getCredentials: async () => ({ baseUrl: 'https://acme.cervio.app' }),
				getNode: () => ({}),
				helpers: { httpRequestWithAuthentication: http },
			} as never,
			'11111111-1111-4111-8111-111111111111',
			undefined as never,
		);
		expect((http.mock.calls[0] as unknown[])[1]).toMatchObject({
			url: 'https://acme.cervio.app/api/v1/entities/11111111-1111-4111-8111-111111111111/forms//write-schema',
		});
	});
});
