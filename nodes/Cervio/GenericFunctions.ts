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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Path segment for a Cervio id. Ids often come from expressions, so they are
 * checked here: a value that is not a UUID never reaches the URL.
 */
export function isUuid(value: string): boolean {
	return UUID_RE.test(value);
}

export function idSegment(value: string, label: string): string {
	const id = String(value ?? '').trim();
	if (!isUuid(id)) {
		throw new Error(`${label} must be a UUID, got "${id.slice(0, 60)}".`);
	}
	return id;
}

/** Path segment for a name (form or field name). */
function nameSegment(value: string): string {
	return encodeURIComponent(String(value ?? '').trim());
}

async function sendCervioRequest(
	this: CervioContext,
	options: Omit<IHttpRequestOptions, 'url'> & { path: string },
): Promise<unknown> {
	const credentials = await this.getCredentials('cervioApi');
	let baseUrl: string;
	try {
		baseUrl = assertSafeCervioBaseUrl(String(credentials.baseUrl ?? ''));
	} catch (error) {
		throw new NodeApiError(this.getNode(), { message: (error as Error).message } as JsonObject);
	}

	const { path, ...rest } = options;
	const request: IHttpRequestOptions = {
		...rest,
		url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
		headers: { Accept: 'application/json', ...(rest.headers ?? {}) },
	};

	try {
		const send = this.helpers.httpRequestWithAuthentication as (
			this: CervioContext,
			credentialsType: string,
			requestOptions: IHttpRequestOptions,
		) => Promise<unknown>;
		return await send.call(this, 'cervioApi', request);
	} catch (error) {
		const message = cervioErrorMessage(error);
		throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message } : {});
	}
}

/**
 * Cervio answers errors as `{ error: code, message }`. n8n would show only a generic
 * text for the HTTP status ("Bad request - please check your parameters"), so the
 * Cervio message becomes the error message.
 */
export function cervioErrorMessage(error: unknown): string | undefined {
	const e = error as {
		response?: { data?: unknown };
		cause?: { response?: { data?: unknown } };
		reason?: { response?: { data?: unknown } };
		error?: unknown;
	} | null;
	// axios-style errors carry the body in response.data; `request` errors in `error`.
	const data =
		e?.response?.data ?? e?.cause?.response?.data ?? e?.reason?.response?.data ?? e?.error;
	if (!data || typeof data !== 'object') return undefined;
	const { message, error: code } = data as { message?: unknown; error?: unknown };
	if (typeof message === 'string' && message.trim()) return message.trim();
	return typeof code === 'string' && code.trim() ? code.trim() : undefined;
}

export async function cervioApiRequest(
	this: CervioContext,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject | undefined = undefined,
	qs: IDataObject = {},
): Promise<unknown> {
	return sendCervioRequest.call(this, {
		method,
		path,
		qs,
		json: true,
		...(body !== undefined ? { body } : {}),
	});
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

export async function listForms(this: CervioContext, entityId: string): Promise<CervioForm[]> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/admin/entities/${idSegment(entityId, 'Entity ID')}/forms`,
	)) as { forms?: CervioForm[] };
	return res.forms ?? [];
}

export async function listViews(this: CervioContext, entityId: string): Promise<CervioView[]> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/admin/entities/${idSegment(entityId, 'Entity ID')}/views`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/forms/${nameSegment(formName)}/write-schema`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/forms/${nameSegment(formName)}/fields/${nameSegment(fieldName)}/relation-options`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}`,
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
		`/api/v1/views/${idSegment(viewId, 'View ID')}/records`,
		undefined,
		qs,
	)) as CervioListPage;
}

export async function countViewRecords(this: CervioContext, viewId: string): Promise<number> {
	const res = (await cervioApiRequest.call(
		this,
		'GET',
		`/api/v1/views/${idSegment(viewId, 'View ID')}/records/count`,
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
	const raw = await sendCervioRequest.call(this, { method, path, body, json: false });
	if (typeof raw !== 'string') return raw;
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return raw;
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/forms/${nameSegment(formName)}/validate-draft`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/upsert`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}/documents`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}/documents`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}/documents/${idSegment(documentId, 'Document ID')}/open`,
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
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/records/${idSegment(recordId, 'Record ID')}/documents/generate`,
		{ template_id: templateId },
	);
}

function linksPath(entityId: string, formName: string, throughFieldName: string): string {
	return `/api/v1/entities/${idSegment(entityId, 'Entity ID')}/forms/${nameSegment(formName)}/fields/${nameSegment(throughFieldName)}/links`;
}

/**
 * Create one N:M link: one junction row, returned by id. The same far record
 * can be linked more than once; only the junction's uniqueness rules forbid it.
 * `data` holds the other junction fields (the two record keys are set by Cervio).
 */
export async function linkThroughRecords(
	this: CervioContext,
	entityId: string,
	formName: string,
	throughFieldName: string,
	fromRecordId: string,
	farRecordId: string,
	data?: IDataObject,
): Promise<{ junction_record_id: string }> {
	const body: IDataObject = {
		from_record_id: idSegment(fromRecordId, 'Record ID'),
		far_record_id: idSegment(farRecordId, 'Far Record ID'),
	};
	if (data && Object.keys(data).length > 0) body.data = data;
	return (await cervioApiRequest.call(
		this,
		'POST',
		linksPath(entityId, formName, throughFieldName),
		body,
	)) as { junction_record_id: string };
}

/** Remove one N:M link: the junction row `junctionRecordId`, which must belong to `fromRecordId`. */
export async function unlinkThroughRecord(
	this: CervioContext,
	entityId: string,
	formName: string,
	throughFieldName: string,
	fromRecordId: string,
	junctionRecordId: string,
): Promise<{ deleted: number }> {
	return (await cervioApiRequest.call(
		this,
		'DELETE',
		linksPath(entityId, formName, throughFieldName),
		{
			from_record_id: idSegment(fromRecordId, 'Record ID'),
			junction_record_id: idSegment(junctionRecordId, 'Junction Record ID'),
		},
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
	return cervioApiRequest.call(
		this,
		'POST',
		`/api/v1/entities/${idSegment(entityId, 'Entity ID')}/resolve`,
		body,
	);
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
		`/api/v1/workflows/${idSegment(workflowId, 'Workflow ID')}/runs`,
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
		`/api/v1/admin/workflows/${idSegment(workflowId, 'Workflow ID')}/runs/${idSegment(runId, 'Run ID')}`,
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
