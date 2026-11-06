/** Maps operation → resource for Resource UX migration and defensive defaults. */

export type CervioResource =
	| 'record'
	| 'relation'
	| 'document'
	| 'workflow'
	| 'notification';

export const OPERATION_RESOURCE: Record<string, CervioResource> = {
	create: 'record',
	update: 'record',
	get: 'record',
	delete: 'record',
	listView: 'record',
	listRecords: 'record',
	validateDraft: 'record',
	upsert: 'record',
	searchRelation: 'relation',
	resolveRelation: 'relation',
	linkRecords: 'relation',
	unlinkRecords: 'relation',
	listDocuments: 'document',
	uploadDocument: 'document',
	openDocument: 'document',
	generateDocument: 'document',
	startWorkflow: 'workflow',
	getWorkflowRun: 'workflow',
	notifySelf: 'notification',
	notifyUsers: 'notification',
};

export function resourceForOperation(operation: string): CervioResource {
	return OPERATION_RESOURCE[operation] ?? 'record';
}
