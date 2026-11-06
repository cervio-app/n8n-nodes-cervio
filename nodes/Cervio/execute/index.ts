import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { resourceForOperation } from '../resourceMap';
import {
	executeListRecordsBatch,
	executeListViewBatch,
	executeSearchRelationBatch,
} from './batchOps';
import { executeDocumentOperations } from './documents';
import { executeRecordOperations } from './records';
import { executeRelationOperations } from './relations';
import { executeWorkflowOperations } from './workflows';

const BATCH_OPS = new Set(['searchRelation', 'listView', 'listRecords']);
const WORKFLOW_OPS = new Set(['startWorkflow', 'getWorkflowRun']);
const DOCUMENT_OPS = new Set([
	'listDocuments',
	'uploadDocument',
	'openDocument',
	'generateDocument',
]);
const RELATION_OPS = new Set(['linkRecords', 'unlinkRecords', 'resolveRelation']);
const RECORD_OPS = new Set([
	'get',
	'delete',
	'create',
	'update',
	'upsert',
	'validateDraft',
]);

export async function executeCervio(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];
	const operation = this.getNodeParameter('operation', 0) as string;

	let resource = this.getNodeParameter('resource', 0, '') as string;
	if (!resource) {
		resource = resourceForOperation(operation);
	}
	if (resource && resourceForOperation(operation) !== resource) {
		throw new NodeOperationError(
			this.getNode(),
			`Operation "${operation}" does not match resource "${resource}". Change resource or operation.`,
		);
	}

	if (BATCH_OPS.has(operation)) {
		let batch: INodeExecutionData[];
		if (operation === 'searchRelation') {
			batch = await executeSearchRelationBatch.call(this);
		} else if (operation === 'listView') {
			batch = await executeListViewBatch.call(this);
		} else {
			batch = await executeListRecordsBatch.call(this);
		}
		return [batch];
	}

	if (WORKFLOW_OPS.has(operation)) {
		await executeWorkflowOperations.call(this, items, operation, returnData);
		return [returnData];
	}

	if (DOCUMENT_OPS.has(operation)) {
		await executeDocumentOperations.call(this, items, operation, returnData);
		return [returnData];
	}

	if (RELATION_OPS.has(operation)) {
		await executeRelationOperations.call(this, items, operation, returnData);
		return [returnData];
	}

	if (RECORD_OPS.has(operation)) {
		await executeRecordOperations.call(this, items, operation, returnData);
		return [returnData];
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`);
}
