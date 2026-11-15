import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { pickCompiledFieldData } from '../writeSchemaMapper';

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
	const mappingMode = ctx.getNodeParameter('fields.mappingMode', itemIndex) as string;
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
		throw new NodeOperationError(ctx.getNode(), 'Values to resolve are required.', { itemIndex });
	}
	if (trimmed.startsWith('[')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch {
			throw new NodeOperationError(ctx.getNode(), 'Invalid values JSON.', { itemIndex });
		}
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(ctx.getNode(), 'Values JSON must be an array.', { itemIndex });
		}
		return parsed.map((v) => String(v).trim()).filter(Boolean);
	}
	return trimmed
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
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
