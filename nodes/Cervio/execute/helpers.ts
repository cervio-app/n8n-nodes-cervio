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
	RELATION_DROPDOWN_LIMIT,
	RELATION_SEARCH_MAX_LIMIT,
	searchRelationOptions,
} from '../GenericFunctions';
import {
	pickCompiledFieldData,
	writeSchemaToMapperFields,
	type WriteDiscoverySchema,
} from '../writeSchemaMapper';

export function requireRecordId(ctx: IExecuteFunctions, itemIndex: number): string {
	const recordId = (ctx.getNodeParameter('recordId', itemIndex) as string)?.trim();
	if (!recordId) {
		throw new NodeOperationError(ctx.getNode(), 'Record ID is required.', {
			itemIndex,
		});
	}
	return recordId;
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
	if (!entityId || !formName) {
		return { fields: [] };
	}

	const schema = (await getWriteSchema.call(
		this,
		entityId,
		formName,
	)) as WriteDiscoverySchema;

	const fields = writeSchemaToMapperFields(schema, mode);

	// Single relations: dropdown when candidates fit under RELATION_DROPDOWN_LIMIT.
	// Multi_select stays array (UUID[]); browse all via “Search Relation”.
	for (const field of fields) {
		const schemaField = schema.fields.find((f) => f.name === field.id);
		if (!schemaField || schemaField.input.mode !== 'relation') continue;

		try {
			const records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				field.id,
				RELATION_DROPDOWN_LIMIT,
			);
			if (schemaField.input.multi_select) {
				if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
					const preview = records
						.slice(0, 8)
						.map((r) => `${r.label} (${r.id})`)
						.join('; ');
					field.description = [
						field.description,
						`Candidate preview: ${preview}${records.length > 8 ? '…' : ''}. Use “Search Relation” to filter.`,
					]
						.filter(Boolean)
						.join(' ');
				} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
					field.description = [
						field.description,
						`≥${RELATION_DROPDOWN_LIMIT} candidates: use “Search Relation” (q + limit up to ${RELATION_SEARCH_MAX_LIMIT}), then UUID[] in Fields.`,
					]
						.filter(Boolean)
						.join(' ');
				}
				continue;
			}

			if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
				field.type = 'options';
				field.options = records.map((r) => ({
					name: r.label,
					value: r.id,
				}));
			} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
				field.description = [
					field.description,
					`Too many records for the dropdown (cap ${RELATION_DROPDOWN_LIMIT}): use “Search Relation” or paste the UUID.`,
				]
					.filter(Boolean)
					.join(' ');
			}
		} catch {
			// Keep as free-text UUID / array field.
		}
	}

	return { fields };
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

