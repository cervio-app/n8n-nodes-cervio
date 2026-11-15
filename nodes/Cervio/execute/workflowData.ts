import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

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
		throw new NodeOperationError(ctx.getNode(), 'Additional Data must be a JSON object.', {
			itemIndex,
		});
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
	const list = Array.isArray(valuesRaw) ? valuesRaw : valuesRaw ? [valuesRaw] : [];

	const out: IDataObject = {};
	for (const row of list) {
		if (!row || typeof row !== 'object') continue;
		const name = String((row as { name?: unknown }).name ?? '').trim();
		const value = (row as { value?: unknown }).value;
		const hasValue =
			value !== undefined && value !== '' && !(typeof value === 'string' && !value.trim());
		if (!name) {
			if (hasValue) {
				throw new NodeOperationError(ctx.getNode(), 'Each Additional Data row must have a name.', {
					itemIndex,
				});
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
	const mode =
		(ctx.getNodeParameter('workflowDataMode', itemIndex, 'keyValue') as string) || 'keyValue';
	if (mode === 'json') {
		const raw = ctx.getNodeParameter('workflowDataJson', itemIndex, {});
		return parseJsonObjectPayload(ctx, raw, itemIndex);
	}
	const raw = ctx.getNodeParameter('workflowData', itemIndex, {});
	return parseWorkflowDataPayload(ctx, raw, itemIndex);
}
