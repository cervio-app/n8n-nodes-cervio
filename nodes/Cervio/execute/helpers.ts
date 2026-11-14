import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	getWriteSchema,
	listForms,
	RELATION_DROPDOWN_LIMIT,
	RELATION_SEARCH_MAX_LIMIT,
	searchRelationOptions,
} from '../GenericFunctions';
import {
	pickCompiledFieldData,
	withoutRelationsTo,
	writeSchemaToMapperFields,
	type WriteDiscoverySchema,
} from '../writeSchemaMapper';

/** Trimmed string, or undefined when empty or not a string. */
export function optionalString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

export function requireString(
	ctx: IExecuteFunctions,
	parameter: string,
	itemIndex: number,
	label: string,
): string {
	const value = optionalString(ctx.getNodeParameter(parameter, itemIndex));
	if (!value) {
		throw new NodeOperationError(ctx.getNode(), `${label} is required.`, { itemIndex });
	}
	return value;
}

export function requireRecordId(ctx: IExecuteFunctions, itemIndex: number): string {
	return requireString(ctx, 'recordId', itemIndex, 'Record ID');
}

export function readMappedFieldData(
	ctx: IExecuteFunctions,
	items: INodeExecutionData[],
	itemIndex: number,
): IDataObject {
	const mappingMode = ctx.getNodeParameter(
		'fields.mappingMode',
		itemIndex,
	) as string;
	let rawFields: IDataObject = {};
	if (mappingMode === 'defineBelow') {
		rawFields = ctx.getNodeParameter('fields.value', itemIndex, {}) as IDataObject;
	} else if (mappingMode === 'autoMapInputData') {
		rawFields = { ...items[itemIndex].json } as IDataObject;
		delete rawFields.id;
	}
	return pickCompiledFieldData(rawFields);
}

/** Other junction fields for Link Records (Junction Fields mapper, defined below only). */
export function readJunctionFieldData(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
	const raw = ctx.getNodeParameter('junctionFields.value', itemIndex, {}) as IDataObject | null;
	return pickCompiledFieldData(raw ?? {});
}

export function parseResolveValues(
	ctx: IExecuteFunctions,
	raw: string,
	itemIndex: number,
): string[] {
	const trimmed = (raw ?? '').trim();
	if (!trimmed) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Values to resolve are required.',
			{ itemIndex },
		);
	}
	if (trimmed.startsWith('[')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch {
			throw new NodeOperationError(
				ctx.getNode(),
				'Invalid values JSON.',
				{ itemIndex },
			);
		}
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'Values JSON must be an array.',
				{ itemIndex },
			);
		}
		return parsed.map((v) => String(v).trim()).filter(Boolean);
	}
	return trimmed
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

export async function buildMapperFields(
	this: ILoadOptionsFunctions,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields> {
	const entityId = this.getNodeParameter('entityId') as string;
	const formName = this.getNodeParameter('formName') as string;
	if (!entityId || !formName) return { fields: [] };
	const schema = (await getWriteSchema.call(this, entityId, formName)) as WriteDiscoverySchema;
	return { fields: await mapperFieldsWithRelationOptions.call(this, entityId, formName, schema, mode) };
}

/**
 * Junction Fields for Link Records: the junction entity's create form, without the
 * two keys Cervio sets itself. Empty when the junction has no other fields.
 */
export async function buildJunctionMapperFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const entityId = this.getNodeParameter('entityId') as string;
	const formName = this.getNodeParameter('formName') as string;
	const throughFieldName = this.getNodeParameter('throughFieldName') as string;
	if (!entityId || !formName || !throughFieldName) return { fields: [] };

	const schema = (await getWriteSchema.call(this, entityId, formName)) as WriteDiscoverySchema;
	const through = schema.fields.find(
		(f) => f.name === throughFieldName && f.input.storage === 'through',
	);
	const junctionEntityId = through?.input.junction_entity_id;
	if (!junctionEntityId) return { fields: [] };

	const forms = await listForms.call(this, junctionEntityId);
	const form = forms.find((f) => f.is_default) ?? forms[0];
	if (!form) return { fields: [] };

	const junctionSchema = withoutRelationsTo(
		(await getWriteSchema.call(this, junctionEntityId, form.name)) as WriteDiscoverySchema,
		[entityId, through.input.relation_entity_id],
	);
	return {
		fields: await mapperFieldsWithRelationOptions.call(
			this,
			junctionEntityId,
			form.name,
			junctionSchema,
			'create',
		),
	};
}

/**
 * Mapper columns for a form. Single relations become a dropdown when their
 * candidates fit under RELATION_DROPDOWN_LIMIT; multi relations stay UUID arrays
 * (browse them with “Search Relation”).
 */
async function mapperFieldsWithRelationOptions(
	this: ILoadOptionsFunctions,
	entityId: string,
	formName: string,
	schema: WriteDiscoverySchema,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields['fields']> {
	const fields = writeSchemaToMapperFields(schema, mode);
	const appendDescription = (field: (typeof fields)[number], text: string) => {
		field.description = [field.description, text].filter(Boolean).join(' ');
	};

	for (const field of fields) {
		const schemaField = schema.fields.find((f) => f.name === field.id);
		if (!schemaField || schemaField.input.mode !== 'relation') continue;

		let records: Array<{ id: string; label: string }>;
		try {
			records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				field.id,
				RELATION_DROPDOWN_LIMIT,
			);
		} catch {
			continue; // Keep the field as free-text UUID / array.
		}
		const fitsDropdown = records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT;

		if (schemaField.input.multi_select) {
			if (fitsDropdown) {
				const preview = records
					.slice(0, 8)
					.map((r) => `${r.label} (${r.id})`)
					.join('; ');
				appendDescription(
					field,
					`Candidate preview: ${preview}${records.length > 8 ? '…' : ''}. Use “Search Relation” to filter.`,
				);
			} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
				appendDescription(
					field,
					`≥${RELATION_DROPDOWN_LIMIT} candidates: use “Search Relation” (q + limit up to ${RELATION_SEARCH_MAX_LIMIT}), then UUID[] in Fields.`,
				);
			}
			continue;
		}

		if (fitsDropdown) {
			field.type = 'options';
			field.options = records.map((r) => ({ name: r.label, value: r.id }));
		} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
			appendDescription(
				field,
				`Too many records for the dropdown (cap ${RELATION_DROPDOWN_LIMIT}): use “Search Relation” or paste the UUID.`,
			);
		}
	}
	return fields;
}

/** Cap aligned with Cervio `MANUAL_DATA_MAX_BYTES` (64 KiB). */
export const WORKFLOW_START_DATA_MAX_BYTES = 64 * 1024;

function assertWorkflowDataSize(
	ctx: IExecuteFunctions,
	data: IDataObject,
	itemIndex: number,
): void {
	const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
	if (bytes > WORKFLOW_START_DATA_MAX_BYTES) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Additional Data is too large (${bytes} bytes; max ${WORKFLOW_START_DATA_MAX_BYTES}).`,
			{ itemIndex },
		);
	}
}

function parseJsonObjectPayload(
	ctx: IExecuteFunctions,
	raw: unknown,
	itemIndex: number,
): IDataObject | undefined {
	if (raw == null || raw === '') return undefined;

	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (!trimmed || trimmed === '{}') return undefined;
		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch {
			throw new NodeOperationError(
				ctx.getNode(),
				'Invalid Additional Data: expected valid JSON object.',
				{ itemIndex },
			);
		}
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Additional Data must be a JSON object.',
			{ itemIndex },
		);
	}
	const obj = parsed as IDataObject;
	if (Object.keys(obj).length === 0) return undefined;
	assertWorkflowDataSize(ctx, obj, itemIndex);
	return obj;
}

/**
 * Build payload for workflow start from fixedCollection (values: name/value rows).
 * Legacy string JSON from older workflows is still accepted when valid.
 */
export function parseWorkflowDataPayload(
	ctx: IExecuteFunctions,
	raw: unknown,
	itemIndex: number,
): IDataObject | undefined {
	if (raw == null || raw === '') return undefined;

	if (typeof raw === 'string') {
		return parseJsonObjectPayload(ctx, raw, itemIndex);
	}

	if (typeof raw !== 'object') return undefined;

	const obj = raw as IDataObject;
	// Plain object without fixedCollection `values` → treat as JSON object (json mode / expressions)
	if (!('values' in obj) && Object.keys(obj).length > 0) {
		assertWorkflowDataSize(ctx, obj, itemIndex);
		return obj;
	}

	const valuesRaw = obj.values;
	const list = Array.isArray(valuesRaw)
		? valuesRaw
		: valuesRaw
			? [valuesRaw]
			: [];

	const out: IDataObject = {};
	for (const row of list) {
		if (!row || typeof row !== 'object') continue;
		const name = String((row as { name?: unknown }).name ?? '').trim();
		const value = (row as { value?: unknown }).value;
		const hasValue =
			value !== undefined &&
			value !== '' &&
			!(typeof value === 'string' && !value.trim());
		if (!name) {
			if (hasValue) {
				throw new NodeOperationError(
					ctx.getNode(),
					'Each Additional Data row must have a name.',
					{ itemIndex },
				);
			}
			continue;
		}
		out[name] = value as IDataObject[string];
	}

	if (Object.keys(out).length === 0) return undefined;
	assertWorkflowDataSize(ctx, out, itemIndex);
	return out;
}

/** Resolve start `data` from Additional Data Mode (keyValue | json). */
export function resolveWorkflowStartData(
	ctx: IExecuteFunctions,
	itemIndex: number,
): IDataObject | undefined {
	const mode = (ctx.getNodeParameter('workflowDataMode', itemIndex, 'keyValue') as string) ||
		'keyValue';
	if (mode === 'json') {
		const raw = ctx.getNodeParameter('workflowDataJson', itemIndex, {});
		return parseJsonObjectPayload(ctx, raw, itemIndex);
	}
	const raw = ctx.getNodeParameter('workflowData', itemIndex, {});
	return parseWorkflowDataPayload(ctx, raw, itemIndex);
}

export function parseMultiValueModes(
	raw: unknown,
): Record<string, 'add' | 'replace' | 'remove'> | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const entries = (raw as { entry?: unknown }).entry;
	const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
	const out: Record<string, 'add' | 'replace' | 'remove'> = {};
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const field = String((item as { field?: unknown }).field ?? '').trim();
		const mode = String((item as { mode?: unknown }).mode ?? '').trim();
		if (!field) continue;
		if (mode === 'add' || mode === 'replace' || mode === 'remove') {
			out[field] = mode;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

