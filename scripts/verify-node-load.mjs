#!/usr/bin/env node
/**
 * Offline check: load the compiled node + credential and assert the guided UX surface.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const stub = {
	NodeConnectionTypes: { Main: 'main' },
	NodeApiError: class NodeApiError extends Error {},
	NodeOperationError: class NodeOperationError extends Error {},
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
	if (request === 'n8n-workflow') return 'n8n-workflow-stub';
	return origResolve.call(this, request, parent, isMain, options);
};
Module._cache['n8n-workflow-stub'] = {
	id: 'n8n-workflow-stub',
	filename: 'n8n-workflow-stub',
	loaded: true,
	exports: stub,
};

const { Cervio } = require(join(root, 'dist/nodes/Cervio/Cervio.node.js'));
const { CervioApi } = require(join(root, 'dist/credentials/CervioApi.credentials.js'));

const node = new Cervio();
const cred = new CervioApi();

if (cred.displayName !== 'Cervio API') throw new Error('credential displayName');
if (!cred.test?.request?.url?.includes('/api/v1/me')) throw new Error('credential test URL');

const ALL_OPERATIONS = [
	'create',
	'update',
	'listView',
	'searchRelation',
	'get',
	'delete',
	'listRecords',
	'validateDraft',
	'upsert',
	'listDocuments',
	'uploadDocument',
	'openDocument',
	'generateDocument',
	'linkRecords',
	'unlinkRecords',
	'resolveRelation',
	'startWorkflow',
	'getWorkflowRun',
];

const ops = node.description.properties.find((p) => p.name === 'operation');
const values = (ops?.options || []).map((o) => o.value);
for (const need of ALL_OPERATIONS) {
	if (!values.includes(need)) throw new Error(`missing operation ${need}`);
}

const mappers = node.description.properties.filter((p) => p.type === 'resourceMapper');
if (mappers.length < 3) {
	throw new Error(
		'expected resourceMapper for create, update, and validateDraft/upsert',
	);
}
const mapperOps = new Set(
	mappers.flatMap((p) => p.displayOptions?.show?.operation ?? []),
);
for (const need of ['create', 'update', 'validateDraft', 'upsert']) {
	if (!mapperOps.has(need)) {
		throw new Error(`resourceMapper missing operation ${need}`);
	}
}

const methods = Object.keys(node.methods?.loadOptions || {});
for (const need of [
	'getEntities',
	'getForms',
	'getViews',
	'getRelationFields',
	'getThroughFields',
	'getMatchFields',
	'getWorkflows',
]) {
	if (!methods.includes(need)) throw new Error(`missing loadOptions.${need}`);
}

const entityProp = node.description.properties.find((p) => p.name === 'entityId');
const hideOps = entityProp?.displayOptions?.hide?.operation ?? [];
for (const op of ['startWorkflow', 'getWorkflowRun']) {
	if (!hideOps.includes(op)) throw new Error(`entityId should hide for ${op}`);
}

const optionsMode = node.description.properties.find((p) => p.name === 'optionsMode');
const relationsMode = node.description.properties.find((p) => p.name === 'relationsMode');
if (optionsMode?.default !== 'slugs') throw new Error('optionsMode default should be slugs');
if (relationsMode?.default !== 'uuids') throw new Error('relationsMode default should be uuids');

const mapping = Object.keys(node.methods?.resourceMapping || {});
if (!mapping.includes('getFormFieldsCreate') || !mapping.includes('getFormFieldsUpdate')) {
	throw new Error('missing resourceMapping methods');
}

console.log('VERIFY NODE LOAD OK');
console.log('operations:', values.join(', '));
console.log('credential:', cred.displayName);
