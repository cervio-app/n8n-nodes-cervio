import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { resourceForOperation } from '../resourceMap';
import { documentOperations } from './documents';
import { listOperations } from './lists';
import { notificationOperations } from './notifications';
import { recordOperations } from './records';
import { relationOperations } from './relations';
import type { OperationHandler } from './types';
import { workflowOperations } from './workflows';

const OPERATIONS: Record<string, OperationHandler> = {
	...recordOperations,
	...listOperations,
	...relationOperations,
	...documentOperations,
	...workflowOperations,
	...notificationOperations,
};

/** Wraps any error as an n8n node error tied to the item, keeping API errors as they are. */
function toNodeError(
	ctx: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		if (error.context.itemIndex === undefined) error.context.itemIndex = itemIndex;
		return error;
	}
	return new NodeOperationError(ctx.getNode(), error instanceof Error ? error : String(error), {
		itemIndex,
	});
}

/**
 * Runs the selected operation once per input item. Each output item is paired with
 * the input item it came from; with "Continue On Fail" a failed item becomes
 * `{ error }` and the others still run.
 */
export async function executeCervio(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const operation = this.getNodeParameter('operation', 0) as string;
	const resource =
		(this.getNodeParameter('resource', 0, '') as string) || resourceForOperation(operation);
	if (resourceForOperation(operation) !== resource) {
		throw new NodeOperationError(
			this.getNode(),
			`Operation "${operation}" does not match resource "${resource}". Change resource or operation.`,
		);
	}
	const handler = OPERATIONS[operation];
	if (!handler) {
		throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`);
	}

	const returnData: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const result = await handler.call(this, i, items);
			for (const json of Array.isArray(result) ? result : [result]) {
				returnData.push({ json, pairedItem: { item: i } });
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: error instanceof Error ? error.message : String(error) },
					pairedItem: { item: i },
				});
				continue;
			}
			throw toNodeError(this, error, i);
		}
	}
	return [returnData];
}
