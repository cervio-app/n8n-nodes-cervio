import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	coerceWriteValue,
	formLabelWithRole,
	isWritableMapperField,
	pickCompiledFieldValues,
	writeSchemaToMapperFields,
	type WriteDiscoveryField,
	type WriteDiscoverySchema,
} from '../writeSchemaMapper';

const fixture = JSON.parse(
	readFileSync(
		join(__dirname, 'fixtures/testmcp-write-schema.json'),
		'utf8',
	),
) as WriteDiscoverySchema;

describe('writeSchemaToMapperFields (TESTMCP)', () => {
	it('maps writable fields and skips computed / readonly / through', () => {
		const fields = writeSchemaToMapperFields(fixture, 'create');
		const ids = fields.map((f) => f.id);
		expect(ids).toEqual([
			'nome',
			'data_inizio',
			'data_fine',
			'stato',
			'budget',
		]);
		expect(ids).not.toContain('calcolato');
		expect(ids).not.toContain('solo_lettura');
		expect(ids).not.toContain('link_nm');
	});

	it('maps Stato as options with fixed_list values', () => {
		const fields = writeSchemaToMapperFields(fixture, 'create');
		const stato = fields.find((f) => f.id === 'stato');
		expect(stato?.type).toBe('options');
		expect(stato?.options).toEqual([
			{ name: 'In corso', value: 'In corso' },
			{ name: 'Completato', value: 'Completato' },
			{ name: 'Sospeso', value: 'Sospeso' },
		]);
	});

	it('maps dates as dateTime and budget as number', () => {
		const fields = writeSchemaToMapperFields(fixture, 'create');
		expect(fields.find((f) => f.id === 'data_inizio')?.type).toBe('dateTime');
		expect(fields.find((f) => f.id === 'budget')?.type).toBe('number');
	});

	it('keeps required flags on create, drops them on update', () => {
		const create = writeSchemaToMapperFields(fixture, 'create');
		const update = writeSchemaToMapperFields(fixture, 'update');
		expect(create.find((f) => f.id === 'nome')?.required).toBe(true);
		expect(update.find((f) => f.id === 'nome')?.required).toBe(false);
		expect(update.every((f) => f.required === false)).toBe(true);
	});
});

describe('isWritableMapperField', () => {
	it('rejects through / computed / readonly', () => {
		const through = fixture.fields.find((f) => f.name === 'link_nm')!;
		const computed = fixture.fields.find((f) => f.name === 'calcolato')!;
		const readonly = fixture.fields.find((f) => f.name === 'solo_lettura')!;
		expect(isWritableMapperField(through)).toBe(false);
		expect(isWritableMapperField(computed)).toBe(false);
		expect(isWritableMapperField(readonly)).toBe(false);
		expect(isWritableMapperField(fixture.fields[0]!)).toBe(true);
	});
});

describe('pickCompiledFieldValues', () => {
	it('drops empty strings and keeps false / 0', () => {
		expect(
			pickCompiledFieldValues({
				a: '',
				b: '  ',
				c: null,
				d: undefined,
				e: 0,
				f: false,
				g: 'ok',
			}),
		).toEqual({ e: 0, f: false, g: 'ok' });
	});

	it('coerces listView {id,label} and UUID arrays for write-back', () => {
		expect(
			pickCompiledFieldValues({
				stato: { id: 'In corso', label: 'In corso' },
				sede_id: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'Sede' },
				controllers: [
					{ id: '11111111-1111-1111-1111-111111111111', label: 'A' },
					{ id: '22222222-2222-2222-2222-222222222222', label: 'B' },
				],
			}),
		).toEqual({
			stato: 'In corso',
			sede_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
			controllers: [
				'11111111-1111-1111-1111-111111111111',
				'22222222-2222-2222-2222-222222222222',
			],
		});
	});
});

describe('coerceWriteValue', () => {
	it('parses JSON array strings and comma-separated UUIDs', () => {
		expect(coerceWriteValue('["a","b"]')).toEqual(['a', 'b']);
		expect(
			coerceWriteValue(
				'11111111-1111-1111-1111-111111111111, 22222222-2222-2222-2222-222222222222',
			),
		).toEqual([
			'11111111-1111-1111-1111-111111111111',
			'22222222-2222-2222-2222-222222222222',
		]);
	});
});

describe('writeSchemaToMapperFields dedup', () => {
	it('keeps the first occurrence when the same field name is repeated', () => {
		const dup: WriteDiscoverySchema = {
			form: { id: 'f', name: 'default', label: 'Dup' },
			fields: [
				{
					name: 'sede_id',
					label: 'Sede A',
					field_type: 'relation',
					value_shape: 'uuid',
					required: false,
					readonly: false,
					order: 10,
					instructions: 'first',
					input: { mode: 'relation', multi_select: false },
				},
				{
					name: 'sede_id',
					label: 'Sede B',
					field_type: 'relation',
					value_shape: 'uuid',
					required: false,
					readonly: false,
					order: 20,
					instructions: 'second',
					input: { mode: 'relation', multi_select: false },
				},
				{
					name: 'nome',
					label: 'Nome',
					field_type: 'text',
					value_shape: 'string',
					required: true,
					readonly: false,
					order: 0,
					instructions: null,
					input: { mode: 'none' },
				},
			] as WriteDiscoveryField[],
		};
		const fields = writeSchemaToMapperFields(dup, 'create');
		expect(fields.filter((f) => f.id === 'sede_id')).toHaveLength(1);
		expect(fields.find((f) => f.id === 'sede_id')?.displayName).toBe('Sede A');
		expect(fields.map((f) => f.id)).toEqual(['nome', 'sede_id']);
	});
});

describe('formLabelWithRole', () => {
	it('annotates creazione and modifica', () => {
		expect(
			formLabelWithRole({
				name: 'default',
				label: 'TESTMCP',
				is_default: true,
				is_default_view: true,
			}),
		).toBe('TESTMCP (modifica, creazione)');
		expect(
			formLabelWithRole({ name: 'other', label: 'Altra', is_default: true }),
		).toBe('Altra (creazione)');
	});
});
