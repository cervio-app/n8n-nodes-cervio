import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { assertSafeCervioBaseUrl } from './baseUrl';

type CervioContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

export async function cervioApiRequest(
	this: CervioContext,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject | undefined = undefined,
	qs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('cervioApi');
	let baseUrl: string;
	try {
		baseUrl = assertSafeCervioBaseUrl(String(credentials.baseUrl ?? ''));
	} catch (error) {
		throw new NodeApiError(this.getNode(), {
			message: error instanceof Error ? error.message : String(error),
		} as JsonObject);
	}

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
		qs,
		json: true,
		headers: {
			Accept: 'application/json',
		},
	};

	if (body !== undefined) {
		options.body = body;
	}

	try {
		const request = this.helpers.httpRequestWithAuthentication as (
			this: CervioContext,
			credentialsType: string,
			requestOptions: IHttpRequestOptions,
		) => Promise<unknown>;
		return await request.call(this, 'cervioApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export type CervioEntity = {
	id: string;
	name?: string;
	label?: string;
};

export type CervioForm = {
	id: string;
	name: string;
	label: string;
	is_default?: boolean;
	is_default_view?: boolean;
};

export type CervioView = {
	id: string;
	name: string;
	label: string;
	is_default?: boolean;
};

export type CervioListPage = {
	records: Array<{ id: string; data: Record<string, unknown> }>;
	page: {
		limit: number;
		has_more: boolean;
		next_cursor?: string;
	};
	locale?: string;
};

export async function listEntities(this: CervioContext): Promise<CervioEntity[]> {
	const res = (await cervioApiRequest.call(this, 'GET', '/api/v1/entities')) as {
		entities?: CervioEntity[];
	};
	return res.entities ?? [];
}

export async function listForms(
	this: CervioContext,
	entityId: string,
): Promise<CervioForm[]> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/admin/entities/${entityId}/forms`,
	)) as { forms?: CervioForm[] };
	return res.forms ?? [];
}

export async function listViews(
	this: CervioContext,
	entityId: string,
): Promise<CervioView[]> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/admin/entities/${entityId}/views`,
	)) as { views?: CervioView[] };
	return res.views ?? [];
}

export async function getWriteSchema(
	this: CervioContext,
	entityId: string,
	formName: string,
): Promise<unknown> {
	return cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/entities/${entityId}/forms/${encodeURIComponent(formName)}/write-schema`,
	);
}

/** Dropdown preview size (keep UI light). Full browse: searchRelation with q + limit≤100. */
export const RELATION_DROPDOWN_LIMIT = 50;
export const RELATION_SEARCH_MAX_LIMIT = 100;

export async function searchRelationOptions(
	this: CervioContext,
	entityId: string,
	formName: string,
	fieldName: string,
	limit = RELATION_DROPDOWN_LIMIT,
	q?: string,
): Promise<Array<{ id: string; label: string }>> {
	const capped = Math.min(
		RELATION_SEARCH_MAX_LIMIT,
		Math.max(1, Math.floor(Number(limit)) || RELATION_DROPDOWN_LIMIT),
	);
	const qs: IDataObject = { limit: capped };
	if (typeof q === 'string' && q.trim()) qs.q = q.trim();
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/entities/${entityId}/forms/${encodeURIComponent(formName)}/fields/${encodeURIComponent(fieldName)}/relation-options`,
		undefined,
		qs,
	)) as { records?: Array<{ id: string; label?: string }> };
	return (res.records ?? []).map((r) => ({
		id: r.id,
		label: r.label ?? r.id,
	}));
}

export async function createRecord(
	this: CervioContext,
	entityId: string,
	formName: string,
	data: IDataObject,
): Promise<{ id: string }> {
	return (await cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/entities/${entityId}/records`,
		{ form_name: formName, data },
	)) as { id: string };
}

export async function updateRecord(
	this: CervioContext,
	entityId: string,
	recordId: string,
	formName: string,
	data: IDataObject,
	expectedUpdatedAt?: string,
	multiValueModes?: Record<string, 'add' | 'replace' | 'remove'>,
): Promise<{ id: string }> {
	const body: IDataObject = { form_name: formName, data };
	if (expectedUpdatedAt) {
		body.expected_updated_at = expectedUpdatedAt;
	}
	if (multiValueModes && Object.keys(multiValueModes).length > 0) {
		body.multi_value_modes = multiValueModes;
	}
	return (await cervioApiRequest.call(
		this,
		'PATCH',
		`/api/v1/entities/${entityId}/records/${recordId}`,
		body,
	)) as { id: string };
}

export async function listViewRecords(
	this: CervioContext,
	viewId: string,
	qs: IDataObject,
): Promise<CervioListPage> {
	return (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/views/${viewId}/records`,
		undefined,
		qs,
	)) as CervioListPage;
}

export async function countViewRecords(
	this: CervioContext,
	viewId: string,
): Promise<number> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/views/${viewId}/records/count`,
	)) as { count?: number };
	return res.count ?? 0;
}

export const MAX_PAGES = 10;
export const MAX_PAGE_LIMIT = 500;

export async function cervioApiRequestMultipart(
	this: CervioContext,
	method: IHttpRequestMethods,
	path: string,
	body: FormData,
): Promise<unknown> {
	const credentials = await this.getCredentials('cervioApi');
	let baseUrl: string;
	try {
		baseUrl = assertSafeCervioBaseUrl(String(credentials.baseUrl ?? ''));
	} catch (error) {
		throw new NodeApiError(this.getNode(), {
			message: error instanceof Error ? error.message : String(error),
		} as JsonObject);
	}

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
		body,
		json: false,
		headers: {
			Accept: 'application/json',
		},
	};

	try {
		const request = this.helpers.httpRequestWithAuthentication as (
			this: CervioContext,
			credentialsType: string,
			requestOptions: IHttpRequestOptions,
		) => Promise<unknown>;
		const raw = await request.call(this, 'cervioApi', options);
		if (typeof raw === 'string') {
			try {
				return JSON.parse(raw) as unknown;
			} catch {
				return raw;
			}
		}
		return raw;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export type CervioWorkflow = {
	id: string;
	name?: string;
	description?: string;
	is_active?: boolean;
	entity_id?: string | null;
};

export async function listWorkflows(this: CervioContext): Promise<CervioWorkflow[]> {
	const res = (await cervioApiRequest.call(this, 'GET', '/api/v1/admin/workflows')) as {
		workflows?: CervioWorkflow[];
	};
	return res.workflows ?? [];
}

export async function getRecord(
	this: CervioContext,
	entityId: string,
	recordId: string,
): Promise<unknown> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/entities/${entityId}/records/${recordId}`,
	)) as { record?: unknown };
	return res.record;
}

export async function deleteRecord(
	this: CervioContext,
	entityId: string,
	recordId: string,
): Promise<{ ok: boolean }> {
	return (await cervioApiRequest.call(
		this,
		'DELETE',
		`/api/v1/entities/${entityId}/records/${recordId}`,
	)) as { ok: boolean };
}

export async function listEntityRecords(
	this: CervioContext,
	entityId: string,
	qs: IDataObject,
): Promise<Array<{ id: string; data?: Record<string, unknown> }>> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/entities/${entityId}/records`,
		undefined,
		qs,
	)) as { records?: Array<{ id: string; data?: Record<string, unknown> }> };
	return res.records ?? [];
}

export async function validateDraft(
	this: CervioContext,
	entityId: string,
	formName: string,
	data: IDataObject,
	recordId?: string,
): Promise<unknown> {
	const body: IDataObject = { data };
	if (recordId) body.record_id = recordId;
	return cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/entities/${entityId}/forms/${encodeURIComponent(formName)}/validate-draft`,
		body,
	);
}

export async function upsertRecord(
	this: CervioContext,
	entityId: string,
	formName: string,
	matchField: string,
	data: IDataObject,
): Promise<{ id: string; action?: string }> {
	return (await cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/entities/${entityId}/records/upsert`,
		{ form_name: formName, match_field: matchField, data },
	)) as { id: string; action?: string };
}

export async function listRecordDocuments(
	this: CervioContext,
	entityId: string,
	recordId: string,
): Promise<unknown[]> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/entities/${entityId}/records/${recordId}/documents`,
	)) as { documents?: unknown[] };
	return res.documents ?? [];
}

export async function uploadRecordDocument(
	this: CervioContext,
	entityId: string,
	recordId: string,
	form: FormData,
): Promise<unknown> {
	return cervioApiRequestMultipart.call(
		this,
		'POST',
		`/api/v1/entities/${entityId}/records/${recordId}/documents`,
		form,
	);
}

export async function openRecordDocument(
	this: CervioContext,
	entityId: string,
	recordId: string,
	documentId: string,
): Promise<unknown> {
	return cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/entities/${entityId}/records/${recordId}/documents/${documentId}/open`,
	);
}

export async function generateRecordDocument(
	this: CervioContext,
	entityId: string,
	recordId: string,
	templateId: string,
): Promise<unknown> {
	return cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/entities/${entityId}/records/${recordId}/documents/generate`,
		{ template_id: templateId },
	);
}

export async function linkThroughRecords(
	this: CervioContext,
	entityId: string,
	formName: string,
	fieldName: string,
	fromRecordId: string,
	farRecordId: string,
): Promise<{ junction_record_id: string }> {
	return (await cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/entities/${entityId}/forms/${encodeURIComponent(formName)}/fields/${encodeURIComponent(fieldName)}/links`,
		{ from_record_id: fromRecordId, far_record_id: farRecordId },
	)) as { junction_record_id: string };
}

export async function unlinkThroughRecords(
	this: CervioContext,
	entityId: string,
	formName: string,
	fieldName: string,
	fromRecordId: string,
	farRecordId: string,
): Promise<{ deleted: number }> {
	return (await cervioApiRequest.call(
		this,
		'DELETE',
		`/api/v1/entities/${entityId}/forms/${encodeURIComponent(formName)}/fields/${encodeURIComponent(fieldName)}/links`,
		{ from_record_id: fromRecordId, far_record_id: farRecordId },
	)) as { deleted: number };
}

export async function resolveNaturalKeys(
	this: CervioContext,
	entityId: string,
	matchField: string,
	values: string[],
	fieldName?: string,
): Promise<unknown> {
	const body: IDataObject = { match_field: matchField, values };
	if (fieldName) body.field_name = fieldName;
	return cervioApiRequest.call(this, 'POST', `/api/v1/entities/${entityId}/resolve`, body);
}

export async function startWorkflowRun(
	this: CervioContext,
	workflowId: string,
	entityDataId: string,
	data?: IDataObject,
): Promise<{ invocation_id: string }> {
	const body: IDataObject = { entity_data_id: entityDataId };
	if (data && Object.keys(data).length > 0) body.data = data;
	return (await cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/workflows/${workflowId}/runs`,
		body,
	)) as { invocation_id: string };
}

export async function getWorkflowRunStatus(
	this: CervioContext,
	workflowId: string,
	runId: string,
): Promise<unknown> {
	return cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/admin/workflows/${workflowId}/runs/${runId}`,
	);
}

export type CervioNotifyPayload = {
	title: string;
	body?: string;
	href?: string;
	category?: string;
	source_type?: string;
	source_id?: string;
};

export async function notifySelf(
	this: CervioContext,
	payload: CervioNotifyPayload,
): Promise<unknown> {
	return cervioApiRequest.call(this, 'POST', '/api/v1/me/notifications', payload);
}

export async function notifyUsers(
	this: CervioContext,
	userIds: string[],
	payload: CervioNotifyPayload,
): Promise<unknown> {
	return cervioApiRequest.call(this, 'POST', '/api/v1/notifications', {
		user_ids: userIds,
		...payload,
	});
}

/** Flatten GET record or list row to one n8n item. */
export function flattenRecordRow(record: unknown): IDataObject {
	if (!record || typeof record !== 'object' || Array.isArray(record)) {
		return {};
	}
	const row = record as {
		id?: string;
		data?: Record<string, unknown>;
		[key: string]: unknown;
	};
	if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
		return { id: row.id, ...row.data };
	}
	const { id, ...rest } = row;
	const out: IDataObject = {};
	if (id != null) out.id = id;
	for (const [k, v] of Object.entries(rest)) {
		if (k !== 'entity_id' && k !== 'created_at' && k !== 'updated_at') {
			out[k] = v as IDataObject[string];
		}
	}
	return out;
}
