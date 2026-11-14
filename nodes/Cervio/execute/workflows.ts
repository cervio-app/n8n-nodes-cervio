import type { IDataObject } from 'n8n-workflow';

import { getWorkflowRunStatus, startWorkflowRun } from '../GenericFunctions';
import { requireString, resolveWorkflowStartData } from './helpers';
import type { OperationHandler } from './types';

export const workflowOperations: Record<string, OperationHandler> = {
	async startWorkflow(i) {
		const workflowId = this.getNodeParameter('workflowId', i) as string;
		const entityDataId = requireString(this, 'entityDataId', i, 'Record ID (entity_data_id)');
		const data = resolveWorkflowStartData(this, i);
		return (await startWorkflowRun.call(this, workflowId, entityDataId, data)) as IDataObject;
	},

	async getWorkflowRun(i) {
		const workflowId = this.getNodeParameter('workflowId', i) as string;
		const runId = requireString(this, 'runId', i, 'Run ID');
		return (await getWorkflowRunStatus.call(this, workflowId, runId)) as IDataObject;
	},
};
