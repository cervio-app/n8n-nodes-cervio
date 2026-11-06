import type {
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ResourceMapperFields,
} from 'n8n-workflow';

import {
	getWriteSchema,
	listEntities,
	listForms,
	listViews,
	listWorkflows,
} from '../GenericFunctions';
import { formLabelWithRole, type WriteDiscoverySchema } from '../writeSchemaMapper';
import { buildMapperFields } from '../execute/helpers';

export const cervioMethods = {
		loadOptions: {
			async getEntities(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entities = await listEntities.call(this);
				return entities
					.map((e) => ({
						name: e.label || e.name || e.id,
						value: e.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name, 'en'));
			},

			async getForms(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				if (!entityId) return [];
				const forms = await listForms.call(this, entityId);
				const sorted = forms.slice().sort((a, b) => {
					const score = (f: typeof a) =>
						(f.is_default_view ? 0 : 2) + (f.is_default ? 0 : 1);
					const d = score(a) - score(b);
					if (d !== 0) return d;
					return (a.label || a.name).localeCompare(b.label || b.name, 'it');
				});
				return sorted.map((f) => ({
					name: formLabelWithRole(f),
					value: f.name,
				}));
			},

			async getViews(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				if (!entityId) return [];
				const views = await listViews.call(this, entityId);
				return views
					.slice()
					.sort((a, b) => {
						if (a.is_default && !b.is_default) return -1;
						if (!a.is_default && b.is_default) return 1;
						return (a.label || a.name).localeCompare(b.label || b.name, 'it');
					})
					.map((v) => ({
						name: v.is_default
							? `${v.label || v.name} (default)`
							: v.label || v.name,
						value: v.id,
					}));
			},

			async getRelationFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				const formName = this.getNodeParameter('formName') as string;
				if (!entityId || !formName) return [];
				const schema = (await getWriteSchema.call(
					this,
					entityId,
					formName,
				)) as WriteDiscoverySchema;
				const seen = new Set<string>();
				const out: INodePropertyOptions[] = [];
				for (const field of schema.fields.slice().sort((a, b) => a.order - b.order)) {
					if (field.input.mode !== 'relation') continue;
					if (field.input.storage === 'through') continue;
					if (seen.has(field.name)) continue;
					seen.add(field.name);
					const multi = field.input.multi_select ? ' (multi)' : '';
					out.push({
						name: `${field.label || field.name}${multi}`,
						value: field.name,
					});
				}
				return out;
			},

			async getThroughFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				const formName = this.getNodeParameter('formName') as string;
				if (!entityId || !formName) return [];
				const schema = (await getWriteSchema.call(
					this,
					entityId,
					formName,
				)) as WriteDiscoverySchema;
				const out: INodePropertyOptions[] = [];
				for (const field of schema.fields.slice().sort((a, b) => a.order - b.order)) {
					if (field.input.mode !== 'relation') continue;
					if (field.input.storage !== 'through') continue;
					out.push({
						name: field.label || field.name,
						value: field.name,
					});
				}
				return out;
			},

			async getMatchFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				if (!entityId) return [];
				const formParam = (this.getNodeParameter('formName') as string) || '';
				let formName = formParam.trim();
				if (!formName) {
					const forms = await listForms.call(this, entityId);
					if (forms.length === 0) return [];
					formName = forms[0]!.name;
				}
				const schema = (await getWriteSchema.call(
					this,
					entityId,
					formName,
				)) as WriteDiscoverySchema;
				const scalars = new Set<string>();
				const out: INodePropertyOptions[] = [];
				for (const field of schema.fields) {
					if (field.input.mode === 'relation') continue;
					if (field.readonly || field.server_filled === 'computed') continue;
					if (scalars.has(field.name)) continue;
					scalars.add(field.name);
					out.push({
						name: field.label || field.name,
						value: field.name,
					});
				}
				out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
				return out;
			},

			async getWorkflows(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const workflows = await listWorkflows.call(this);
				return workflows
					.map((w) => ({
						name: w.name || w.id,
						value: w.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name, 'en'));
			},
		},

		resourceMapping: {
			async getFormFieldsCreate(
				this: ILoadOptionsFunctions,
			): Promise<ResourceMapperFields> {
				return buildMapperFields.call(this, 'create');
			},

			async getFormFieldsUpdate(
				this: ILoadOptionsFunctions,
			): Promise<ResourceMapperFields> {
				return buildMapperFields.call(this, 'update');
			},
		},
};
