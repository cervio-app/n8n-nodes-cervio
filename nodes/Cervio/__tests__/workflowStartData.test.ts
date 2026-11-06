import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	WORKFLOW_START_DATA_MAX_BYTES,
	parseWorkflowDataPayload,
	resolveWorkflowStartData,
} from '../execute/helpers';

function mockCtx(
	params: Record<string, unknown>,
): IExecuteFunctions {
	return {
		getNode: () => ({ name: 'Cervio' }),
		getNodeParameter: (name: string, _i?: number, fallback?: unknown) => {
			if (name in params) return params[name];
			return fallback;
		},
	} as unknown as IExecuteFunctions;
}

describe('parseWorkflowDataPayload', () => {
	it('builds object from fixedCollection values', () => {
		const ctx = mockCtx({});
		const out = parseWorkflowDataPayload(
			ctx,
			{ values: [{ name: 'foo', value: 'bar' }, { name: 'n', value: 1 }] },
			0,
		);
		expect(out).toEqual({ foo: 'bar', n: 1 });
	});

	it('parses legacy JSON string', () => {
		const ctx = mockCtx({});
		expect(parseWorkflowDataPayload(ctx, '{"a":true}', 0)).toEqual({ a: true });
	});

	it('rejects arrays', () => {
		const ctx = mockCtx({});
		expect(() => parseWorkflowDataPayload(ctx, '[1]', 0)).toThrow(NodeOperationError);
	});
});

describe('resolveWorkflowStartData', () => {
	it('uses keyValue mode by default', () => {
		const ctx = mockCtx({
			workflowDataMode: 'keyValue',
			workflowData: { values: [{ name: 'x', value: 'y' }] },
		});
		expect(resolveWorkflowStartData(ctx, 0)).toEqual({ x: 'y' });
	});

	it('uses JSON mode object', () => {
		const ctx = mockCtx({
			workflowDataMode: 'json',
			workflowDataJson: { nested: { ok: true }, n: 2 },
		});
		expect(resolveWorkflowStartData(ctx, 0)).toEqual({ nested: { ok: true }, n: 2 });
	});

	it('treats empty JSON object as undefined', () => {
		const ctx = mockCtx({
			workflowDataMode: 'json',
			workflowDataJson: {},
		});
		expect(resolveWorkflowStartData(ctx, 0)).toBeUndefined();
	});

	it('rejects oversized JSON', () => {
		const big = { pad: 'x'.repeat(WORKFLOW_START_DATA_MAX_BYTES) };
		const ctx = mockCtx({
			workflowDataMode: 'json',
			workflowDataJson: big,
		});
		expect(() => resolveWorkflowStartData(ctx, 0)).toThrow(/too large/i);
	});
});
