import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { getWorkflowRunStatus, startWorkflowRun } from '../GenericFunctions';
import { parseWorkflowDataPayload } from './helpers';

export async function executeWorkflowOperations(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	operation: string,
	returnData: INodeExecutionData[],
): Promise<void> {
	for (let i = 0; i < items.length; i++) {
		try {
			const workflowId = this.getNodeParameter('workflowId', i) as string;
			if (operation === 'getWorkflowRun') {
				const runId = (this.getNodeParameter('runId', i) as string)?.trim();
				if (!runId) {
					throw new NodeOperationError(this.getNode(), 'Run ID is required.', {
						itemIndex: i,
					});
				}
				const status = await getWorkflowRunStatus.call(this, workflowId, runId);
				returnData.push({
					json: status as IDataObject,
					pairedItem: { item: i },
				});
				continue;
			}
			const entityDataId = (this.getNodeParameter('entityDataId', i) as string)?.trim();
			if (!entityDataId) {
				throw new NodeOperationError(
					this.getNode(),
					'Record ID (entity_data_id) is required.',
					{ itemIndex: i },
				);
			}
			const rawData = this.getNodeParameter('workflowData', i, {});
			const workflowPayload = parseWorkflowDataPayload(this, rawData, i);
			const started = await startWorkflowRun.call(
				this,
				workflowId,
				entityDataId,
				workflowPayload,
			);
			returnData.push({
				json: started as IDataObject,
				pairedItem: { item: i },
			});
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: {
						error: error instanceof Error ? error.message : String(error),
					},
					pairedItem: { item: i },
				});
				continue;
			}
			if (error instanceof NodeOperationError || error instanceof NodeApiError) {
				// Already an n8n node error from helpers or the API layer
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error -- preserve subclass
				throw error;
			}
			throw new NodeOperationError(
				this.getNode(),
				error instanceof Error ? error.message : String(error),
				{ itemIndex: i },
			);
		}
	}
}
