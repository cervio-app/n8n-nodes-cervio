import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	countViewRecords,
	createRecord,
	deleteRecord,
	flattenRecordRow,
	generateRecordDocument,
	getRecord,
	getWorkflowRunStatus,
	getWriteSchema,
	linkThroughRecords,
	listEntities,
	listEntityRecords,
	listForms,
	listRecordDocuments,
	listViewRecords,
	listViews,
	listWorkflows,
	MAX_PAGE_LIMIT,
	MAX_PAGES,
	openRecordDocument,
	RELATION_DROPDOWN_LIMIT,
	RELATION_SEARCH_MAX_LIMIT,
	resolveNaturalKeys,
	searchRelationOptions,
	startWorkflowRun,
	unlinkThroughRecords,
	updateRecord,
	uploadRecordDocument,
	upsertRecord,
	validateDraft,
} from './GenericFunctions';
import {
	formLabelWithRole,
	pickCompiledFieldValues,
	writeSchemaToMapperFields,
	type WriteDiscoverySchema,
} from './writeSchemaMapper';

export class Cervio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cervio',
		name: 'cervio',
		icon: { light: 'file:cervio.mono.light.svg', dark: 'file:cervio.mono.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Record, documenti, relazioni N:M, upsert/resolve e workflow su REST /api/v1. Maschere guidate per create/update; elenco admin per entity records.',
		defaults: {
			name: 'Cervio',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'cervioApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operazione',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Crea Record',
						value: 'create',
						description: 'Crea un record compilando i campi della maschera',
						action: 'Crea un record',
					},
					{
						name: 'Aggiorna Record',
						value: 'update',
						description:
							'Aggiorna un record per id, solo i campi compilati sulla maschera',
						action: 'Aggiorna un record',
					},
					{
						name: 'Leggi Vista',
						value: 'listView',
						description:
							'Legge i record di una vista (filtri e colonne già sulla vista)',
						action: 'Leggi una vista',
					},
					{
						name: 'Cerca Relazione',
						value: 'searchRelation',
						description:
							'Elenca/cerca candidati per un campo relazione (relation-options, fino a 100)',
						action: 'Cerca candidati relazione',
					},
					{
						name: 'Leggi Record',
						value: 'get',
						description: 'GET record per id (campi mascherati da ACL)',
						action: 'Leggi un record',
					},
					{
						name: 'Elimina Record',
						value: 'delete',
						description: 'Soft delete del record',
						action: 'Elimina un record',
					},
					{
						name: 'Elenca Record',
						value: 'listRecords',
						description:
							'Lista entity records (system_admin; filtri eq.field=value)',
						action: 'Elenca record entità',
					},
					{
						name: 'Valida Bozza',
						value: 'validateDraft',
						description: 'Dry-run formule/validazione maschera',
						action: 'Valida bozza maschera',
					},
					{
						name: 'Upsert Record',
						value: 'upsert',
						description: 'Upsert per chiave naturale (match_field)',
						action: 'Upsert record',
					},
					{
						name: 'Elenca Documenti',
						value: 'listDocuments',
						description: 'Metadati documenti collegati al record',
						action: 'Elenca documenti',
					},
					{
						name: 'Carica Documento',
						value: 'uploadDocument',
						description: 'Upload multipart sul record',
						action: 'Carica documento',
					},
					{
						name: 'Apri Documento',
						value: 'openDocument',
						description: 'URL firmato per il file originale',
						action: 'Apri documento',
					},
					{
						name: 'Genera da Template',
						value: 'generateDocument',
						description: 'Render template → documento (admin)',
						action: 'Genera documento da template',
					},
					{
						name: 'Collega Record',
						value: 'linkRecords',
						description: 'Link N:M (campo through sulla maschera)',
						action: 'Collega record N:M',
					},
					{
						name: 'Scollega Record',
						value: 'unlinkRecords',
						description: 'Unlink N:M',
						action: 'Scollega record N:M',
					},
					{
						name: 'Risolvi Chiave',
						value: 'resolveRelation',
						description: 'Valori natural key → UUID record',
						action: 'Risolvi chiavi naturali',
					},
					{
						name: 'Avvia Workflow',
						value: 'startWorkflow',
						description: 'Avvio manuale workflow su un record',
						action: 'Avvia workflow',
					},
					{
						name: 'Stato Run',
						value: 'getWorkflowRun',
						description: 'Stato run workflow (admin)',
						action: 'Leggi stato run workflow',
					},
				],
				default: 'create',
			},

			// --- Shared: entity ---
			{
				displayName: 'Entità',
				name: 'entityId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getEntities',
				},
				required: true,
				default: '',
				displayOptions: {
					hide: {
						operation: ['startWorkflow', 'getWorkflowRun'],
					},
				},
				description: 'Solo le entità che questo token può leggere.',
			},

			// --- Create / Update: form + fields ---
			{
				displayName: 'Maschera',
				name: 'formName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getForms',
					loadOptionsDependsOn: ['entityId'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: [
							'create',
							'update',
							'searchRelation',
							'validateDraft',
							'upsert',
							'linkRecords',
							'unlinkRecords',
						],
					},
				},
				description:
					'I campi sotto sono quelli di questa maschera, non tutti i campi dell’entità. Cervio rifiuta i campi che non stanno su questa maschera. I collegamenti N:M (through) non compaiono: crea sulla junction.',
			},
			{
				displayName: 'Campo Relazione',
				name: 'relationFieldName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getRelationFields',
					loadOptionsDependsOn: ['entityId', 'formName'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['searchRelation'],
					},
				},
				description:
					'Campo relazione sulla maschera (anche multi-select). Non include i through N:M.',
			},
			{
				displayName: 'Ricerca',
				name: 'relationQuery',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['searchRelation'],
					},
				},
				description:
					'Testo libero passato a relation-options?q=. Vuoto = primi risultati.',
			},
			{
				displayName: 'Limite',
				name: 'relationLimit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 50,
				displayOptions: {
					show: {
						operation: ['searchRelation'],
					},
				},
				description: 'Da 1 a 100 (tetto API Cervio).',
			},
			{
				displayName: 'Id Record',
				name: 'recordId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: [
							'update',
							'get',
							'delete',
							'listDocuments',
							'uploadDocument',
							'openDocument',
							'generateDocument',
							'linkRecords',
							'unlinkRecords',
						],
					},
				},
				description:
					'L’id letto da Leggi vista, per esempio {{ $json.id }}. Non è un campo della maschera.',
			},
			{
				displayName: 'Campo Through (N:M)',
				name: 'throughFieldName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getThroughFields',
					loadOptionsDependsOn: ['entityId', 'formName'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['linkRecords', 'unlinkRecords'],
					},
				},
				description: 'Campo collegamento N:M (storage through) sulla maschera.',
			},
			{
				displayName: 'Id Record Lontano',
				name: 'farRecordId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['linkRecords', 'unlinkRecords'],
					},
				},
				description: 'UUID dell’altro capo del link N:M.',
			},
			{
				displayName: 'Campo Match',
				name: 'matchField',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMatchFields',
					loadOptionsDependsOn: ['entityId', 'formName'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['upsert', 'resolveRelation'],
					},
				},
				description: 'Campo scalare univoco per upsert o resolve.',
			},
			{
				displayName: 'Valori da Risolvere',
				name: 'resolveValues',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['resolveRelation'],
					},
				},
				description:
					'Array JSON ["a","b"] oppure valori separati da virgola. Opzionale field_name sotto Opzioni.',
			},
			{
				displayName: 'Opzioni Resolve',
				name: 'resolveOptions',
				type: 'collection',
				placeholder: 'Aggiungi opzione',
				default: {},
				displayOptions: {
					show: {
						operation: ['resolveRelation'],
					},
				},
				options: [
					{
						displayName: 'Nome Campo Relazione',
						name: 'fieldName',
						type: 'string',
						default: '',
						description:
							'Se impostato, resolve sul target del campo relation invece che sull’entità corrente.',
					},
				],
			},
			{
				displayName: 'Filtri',
				name: 'listRecordsFilters',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: {
					show: {
						operation: ['listRecords'],
					},
				},
				placeholder: 'Aggiungi filtro',
				description: 'Ogni filtro → filter[campo]=eq.valore (AND).',
				options: [
					{
						displayName: 'Filtro',
						name: 'filter',
						values: [
							{
								displayName: 'Campo',
								name: 'field',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Valore',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Limite',
				name: 'listRecordsLimit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 50,
				displayOptions: {
					show: {
						operation: ['listRecords'],
					},
				},
			},
			{
				displayName: 'Offset',
				name: 'listRecordsOffset',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: {
					show: {
						operation: ['listRecords'],
					},
				},
			},
			{
				displayName: 'Id Documento',
				name: 'documentId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['openDocument'],
					},
				},
			},
			{
				displayName: 'Id Template',
				name: 'templateId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['generateDocument'],
					},
				},
				description: 'UUID template documento (nessun elenco REST pubblico).',
			},
			{
				displayName: 'Proprietà Binaria',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						operation: ['uploadDocument'],
					},
				},
				description: 'Campo binary dell’item n8n da inviare come file.',
			},
			{
				displayName: 'Opzioni Upload',
				name: 'uploadOptions',
				type: 'collection',
				placeholder: 'Aggiungi opzione',
				default: {},
				displayOptions: {
					show: {
						operation: ['uploadDocument'],
					},
				},
				options: [
					{
						displayName: 'Titolo',
						name: 'title',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Nome File',
						name: 'fileName',
						type: 'string',
						default: '',
						description: 'Default: nome dal binary o upload.bin',
					},
				],
			},
			{
				displayName: 'Opzioni Valida Bozza',
				name: 'validateDraftOptions',
				type: 'collection',
				placeholder: 'Aggiungi opzione',
				default: {},
				displayOptions: {
					show: {
						operation: ['validateDraft'],
					},
				},
				options: [
					{
						displayName: 'Id Record Esistente',
						name: 'recordId',
						type: 'string',
						default: '',
						description: 'Opzionale: merge con dati già salvati.',
					},
				],
			},
			{
				displayName: 'Workflow',
				name: 'workflowId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getWorkflows',
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['startWorkflow', 'getWorkflowRun'],
					},
				},
			},
			{
				displayName: 'Id Record (entity_data_id)',
				name: 'entityDataId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['startWorkflow'],
					},
				},
				description: 'UUID del record su cui avviare il workflow.',
			},
			{
				displayName: 'Dati Aggiuntivi',
				name: 'workflowData',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						operation: ['startWorkflow'],
					},
				},
				description: 'Payload opzionale passato al trigger manuale.',
			},
			{
				displayName: 'Id Run',
				name: 'runId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['getWorkflowRun'],
					},
				},
				description: 'invocation_id restituito da Avvia workflow.',
			},
			{
				displayName: 'Campi',
				name: 'fields',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				displayOptions: {
					show: {
						operation: ['create'],
					},
				},
				typeOptions: {
					loadOptionsDependsOn: ['entityId', 'formName'],
					resourceMapper: {
						resourceMapperMethod: 'getFormFieldsCreate',
						mode: 'add',
						fieldWords: {
							singular: 'campo',
							plural: 'campi',
						},
						addAllFields: true,
						multiKeyMatch: false,
					},
				},
				description:
					'I campi calcolati da Cervio non compaiono: li compila il server. Usa «Aggiungi tutti i campi» per partire dalla maschera intera.',
			},
			{
				displayName: 'Campi',
				name: 'fields',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				typeOptions: {
					loadOptionsDependsOn: ['entityId', 'formName'],
					resourceMapper: {
						resourceMapperMethod: 'getFormFieldsUpdate',
						mode: 'update',
						fieldWords: {
							singular: 'campo',
							plural: 'campi',
						},
						addAllFields: true,
						multiKeyMatch: false,
					},
				},
				description:
					'Lascia vuoto un campo per non toccarlo. Almeno un campo va compilato. La PATCH fa merge: gli altri valori restano.',
			},
			{
				displayName: 'Campi',
				name: 'fields',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				displayOptions: {
					show: {
						operation: ['validateDraft', 'upsert'],
					},
				},
				typeOptions: {
					loadOptionsDependsOn: ['entityId', 'formName'],
					resourceMapper: {
						resourceMapperMethod: 'getFormFieldsCreate',
						mode: 'add',
						fieldWords: {
							singular: 'campo',
							plural: 'campi',
						},
						addAllFields: true,
						multiKeyMatch: false,
					},
				},
				description: 'Stessa maschera di Crea record.',
			},
			{
				displayName: 'Opzioni Avanzate',
				name: 'updateOptions',
				type: 'collection',
				placeholder: 'Aggiungi opzione',
				default: {},
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				options: [
					{
						displayName: 'Data di Aggiornamento Attesa',
						name: 'expectedUpdatedAt',
						type: 'string',
						default: '',
						description:
							'Se qualcuno ha modificato il record nel frattempo, Cervio risponde 409. Di solito la lasci vuota.',
					},
					{
						displayName: 'Modalità Multi-Valore',
						name: 'multiValueModes',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Aggiungi campo',
						description:
							'Per campi relation multi_select: add | replace (default API) | remove. Il campo deve essere presente in Campi.',
						options: [
							{
								displayName: 'Campo',
								name: 'entry',
								values: [
									{
										displayName: 'Nome Campo',
										name: 'field',
										type: 'string',
										default: '',
										description: 'field_name sulla maschera (es. document_controllers)',
									},
									{
										displayName: 'Modalità',
										name: 'mode',
										type: 'options',
										options: [
											{ name: 'Replace', value: 'replace' },
											{ name: 'Add', value: 'add' },
											{ name: 'Remove', value: 'remove' },
										],
										default: 'replace',
									},
								],
							},
						],
					},
				],
			},

			// --- List view ---
			{
				displayName: 'Vista',
				name: 'viewId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getViews',
					loadOptionsDependsOn: ['entityId'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Questa vista porta già i suoi filtri e le sue colonne. Per un altro insieme di righe scegli un’altra vista.',
			},
			{
				displayName: 'Quante Righe',
				name: 'pageMode',
				type: 'options',
				options: [
					{
						name: 'Prima Pagina',
						value: 'first',
						description: 'Una sola pagina, fino al limite scelto',
					},
					{
						name: 'Tutte le Pagine',
						value: 'all',
						description:
							'Il nodo segue next_cursor da solo (massimo 10 pagine)',
					},
				],
				default: 'first',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Prima pagina: da 1 a 500. La risposta non include il totale. Tutte le pagine: oltre 5000 righe si ferma e segnala che la vista è più lunga.',
			},
			{
				displayName: 'Limite per Pagina',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
				default: 50,
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description: 'Da 1 a 500. La risposta non include il totale.',
			},
			{
				displayName: 'Elenchi (Opzioni Fisse)',
				name: 'optionsMode',
				type: 'options',
				options: [
					{ name: 'Solo Valore Salvato (consigliato per Update)', value: 'slugs' },
					{ name: 'Etichetta e Id', value: 'both' },
					{ name: 'Solo Etichetta', value: 'labels' },
				],
				default: 'slugs',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Default slugs: pronto per Aggiorna. «Etichetta e id» dà oggetti {id,label}: il nodo in Update estrae .id se serve.',
			},
			{
				displayName: 'Collegamenti (Relazioni)',
				name: 'relationsMode',
				type: 'options',
				options: [
					{ name: 'Solo UUID (consigliato per Update)', value: 'uuids' },
					{ name: 'Etichetta e Id', value: 'both' },
					{ name: 'Solo Etichetta', value: 'labels' },
				],
				default: 'uuids',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Default uuids: pronto per Aggiorna. Le colonne lookup della vista restano etichette (non UUID): usa Cerca relazione o GET fuori nodo.',
			},
			{
				displayName: 'Lingua Etichette',
				name: 'locale',
				type: 'options',
				options: [
					{ name: 'Lingua del Profilo', value: '' },
					{ name: 'Italiano', value: 'it' },
					{ name: 'English', value: 'en' },
					{ name: 'Deutsch', value: 'de' },
					{ name: 'Français', value: 'fr' },
					{ name: 'Español', value: 'es' },
				],
				default: '',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Vale per le etichette degli elenchi, non per i nomi dei campi.',
			},
			{
				displayName: 'Includi il Totale',
				name: 'includeCount',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Una richiesta in più. Accendila solo se ti serve il numero.',
			},
			{
				displayName: 'Opzioni Avanzate',
				name: 'listOptions',
				type: 'collection',
				placeholder: 'Aggiungi opzione',
				default: {},
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				options: [
					{
						displayName: 'Continua da Questa Pagina',
						name: 'cursor',
						type: 'string',
						default: '',
						description:
							'Incolla next_cursor di un’esecuzione precedente. Vuoto = dalla prima riga.',
					},
				],
			},
		],
	};

	methods = {
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
					.sort((a, b) => a.name.localeCompare(b.name, 'it'));
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
				out.sort((a, b) => a.name.localeCompare(b.name, 'it'));
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
					.sort((a, b) => a.name.localeCompare(b.name, 'it'));
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		if (operation === 'searchRelation') {
			const entityId = this.getNodeParameter('entityId', 0) as string;
			const formName = this.getNodeParameter('formName', 0) as string;
			const fieldName = this.getNodeParameter(
				'relationFieldName',
				0,
			) as string;
			const q = (this.getNodeParameter('relationQuery', 0, '') as string) || '';
			const limit = Math.min(
				RELATION_SEARCH_MAX_LIMIT,
				Math.max(
					1,
					Number(this.getNodeParameter('relationLimit', 0, 50)) || 50,
				),
			);
			if (!fieldName?.trim()) {
				throw new NodeOperationError(
					this.getNode(),
					'Campo relazione obbligatorio.',
				);
			}
			const records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				fieldName.trim(),
				limit,
				q,
			);
			for (const record of records) {
				returnData.push({
					json: {
						id: record.id,
						label: record.label,
						field: fieldName.trim(),
					},
				});
			}
			return [returnData];
		}

		if (operation === 'listView') {
			const viewId = this.getNodeParameter('viewId', 0) as string;
			const pageMode = this.getNodeParameter('pageMode', 0) as string;
			const limit = Math.min(
				MAX_PAGE_LIMIT,
				Math.max(1, Number(this.getNodeParameter('limit', 0, 50)) || 50),
			);
			const optionsMode = this.getNodeParameter('optionsMode', 0) as string;
			const relationsMode = this.getNodeParameter('relationsMode', 0) as string;
			const locale = (this.getNodeParameter('locale', 0, '') as string) || undefined;
			const includeCount = this.getNodeParameter(
				'includeCount',
				0,
				false,
			) as boolean;
			const listOptions = this.getNodeParameter(
				'listOptions',
				0,
				{},
			) as IDataObject;
			let cursor =
				typeof listOptions.cursor === 'string' && listOptions.cursor.trim()
					? listOptions.cursor.trim()
					: undefined;

			let totalCount: number | undefined;
			if (includeCount) {
				totalCount = await countViewRecords.call(this, viewId);
			}

			const collected: Array<{ id: string; data: Record<string, unknown> }> =
				[];
			let pages = 0;
			let hasMore = false;
			let nextCursor: string | undefined;
			let truncated = false;

			do {
				const qs: IDataObject = {
					limit,
					options: optionsMode,
					relations: relationsMode,
				};
				if (locale) qs.locale = locale;
				if (cursor) qs.cursor = cursor;

				const page = await listViewRecords.call(this, viewId, qs);
				collected.push(...(page.records ?? []));
				pages += 1;
				hasMore = Boolean(page.page?.has_more);
				nextCursor = page.page?.next_cursor;
				cursor = nextCursor;

				if (pageMode !== 'all') break;
				if (!hasMore) break;
				if (pages >= MAX_PAGES) {
					truncated = true;
					break;
				}
			} while (true);

			for (const record of collected) {
				const json: IDataObject = {
					id: record.id,
					...record.data,
				};
				if (totalCount !== undefined) {
					json._view_count = totalCount;
				}
				if (pageMode === 'first' && hasMore && nextCursor) {
					json._next_cursor = nextCursor;
					json._has_more = true;
				}
				if (truncated) {
					json._truncated = true;
					json._next_cursor = nextCursor;
					json._has_more = true;
				}
				returnData.push({ json });
			}

			return [returnData];
		}

		if (operation === 'listRecords') {
			const entityId = this.getNodeParameter('entityId', 0) as string;
			const limit = Math.min(
				MAX_PAGE_LIMIT,
				Math.max(
					1,
					Number(this.getNodeParameter('listRecordsLimit', 0, 50)) || 50,
				),
			);
			const offset = Math.max(
				0,
				Number(this.getNodeParameter('listRecordsOffset', 0, 0)) || 0,
			);
			const qs: IDataObject = { limit, offset };
			const filtersRaw = this.getNodeParameter(
				'listRecordsFilters',
				0,
				{},
			) as IDataObject;
			const filterList = filtersRaw.filter;
			const entries = Array.isArray(filterList)
				? filterList
				: filterList
					? [filterList]
					: [];
			for (const entry of entries) {
				if (!entry || typeof entry !== 'object') continue;
				const field = String((entry as { field?: unknown }).field ?? '').trim();
				const value = String((entry as { value?: unknown }).value ?? '').trim();
				if (!field) continue;
				qs[`filter[${field}]`] = `eq.${value}`;
			}
			const records = await listEntityRecords.call(this, entityId, qs);
			for (const record of records) {
				returnData.push({ json: flattenRecordRow(record) });
			}
			return [returnData];
		}

		const fieldMapperOps = new Set([
			'create',
			'update',
			'upsert',
			'validateDraft',
		]);

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'startWorkflow' || operation === 'getWorkflowRun') {
					const workflowId = this.getNodeParameter('workflowId', i) as string;
					if (operation === 'getWorkflowRun') {
						const runId = (this.getNodeParameter('runId', i) as string)?.trim();
						if (!runId) {
							throw new NodeOperationError(
								this.getNode(),
								'Id run obbligatorio.',
								{ itemIndex: i },
							);
						}
						const status = await getWorkflowRunStatus.call(
							this,
							workflowId,
							runId,
						);
						returnData.push({
							json: status as IDataObject,
							pairedItem: { item: i },
						});
						continue;
					}
					const entityDataId = (
						this.getNodeParameter('entityDataId', i) as string
					)?.trim();
					if (!entityDataId) {
						throw new NodeOperationError(
							this.getNode(),
							'Id record (entity_data_id) obbligatorio.',
							{ itemIndex: i },
						);
					}
					let workflowPayload: IDataObject | undefined;
					const rawData = this.getNodeParameter('workflowData', i, '{}');
					if (typeof rawData === 'string' && rawData.trim()) {
						workflowPayload = JSON.parse(rawData) as IDataObject;
					} else if (rawData && typeof rawData === 'object') {
						workflowPayload = rawData as IDataObject;
					}
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
					continue;
				}

				const entityId = this.getNodeParameter('entityId', i) as string;

				if (operation === 'get') {
					const recordId = requireRecordId(this, i);
					const record = await getRecord.call(this, entityId, recordId);
					returnData.push({
						json: flattenRecordRow(record),
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'delete') {
					const recordId = requireRecordId(this, i);
					await deleteRecord.call(this, entityId, recordId);
					returnData.push({
						json: { ok: true, id: recordId },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'listDocuments') {
					const recordId = requireRecordId(this, i);
					const docs = await listRecordDocuments.call(
						this,
						entityId,
						recordId,
					);
					for (const doc of docs) {
						returnData.push({
							json: doc as IDataObject,
							pairedItem: { item: i },
						});
					}
					if (docs.length === 0) {
						returnData.push({
							json: { _empty: true, record_id: recordId },
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (operation === 'openDocument') {
					const recordId = requireRecordId(this, i);
					const documentId = (
						this.getNodeParameter('documentId', i) as string
					)?.trim();
					if (!documentId) {
						throw new NodeOperationError(
							this.getNode(),
							'Id documento obbligatorio.',
							{ itemIndex: i },
						);
					}
					const opened = await openRecordDocument.call(
						this,
						entityId,
						recordId,
						documentId,
					);
					returnData.push({
						json: opened as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'generateDocument') {
					const recordId = requireRecordId(this, i);
					const templateId = (
						this.getNodeParameter('templateId', i) as string
					)?.trim();
					if (!templateId) {
						throw new NodeOperationError(
							this.getNode(),
							'Id template obbligatorio.',
							{ itemIndex: i },
						);
					}
					const generated = await generateRecordDocument.call(
						this,
						entityId,
						recordId,
						templateId,
					);
					returnData.push({
						json: generated as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'uploadDocument') {
					const recordId = requireRecordId(this, i);
					const binaryProperty =
						(this.getNodeParameter('binaryPropertyName', i, 'data') as string) ||
						'data';
					const uploadOptions = this.getNodeParameter(
						'uploadOptions',
						i,
						{},
					) as IDataObject;
					const buffer = await this.helpers.getBinaryDataBuffer(
						i,
						binaryProperty,
					);
					const binaryBag = items[i].binary as
						| Record<string, { fileName?: string; mimeType?: string }>
						| undefined;
					const binaryMeta = binaryBag?.[binaryProperty];
					const fileName =
						(typeof uploadOptions.fileName === 'string' &&
						uploadOptions.fileName.trim()
							? uploadOptions.fileName.trim()
							: binaryMeta?.fileName) || 'upload.bin';
					const form = new FormData();
					const mime =
						binaryMeta?.mimeType && binaryMeta.mimeType.trim()
							? binaryMeta.mimeType
							: 'application/octet-stream';
					form.append(
						'file',
						new Blob([new Uint8Array(buffer)], { type: mime }),
						fileName,
					);
					if (
						typeof uploadOptions.title === 'string' &&
						uploadOptions.title.trim()
					) {
						form.append('title', uploadOptions.title.trim());
					}
					form.append('file_name', fileName);
					const uploaded = await uploadRecordDocument.call(
						this,
						entityId,
						recordId,
						form,
					);
					returnData.push({
						json: uploaded as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'linkRecords' || operation === 'unlinkRecords') {
					const formName = this.getNodeParameter('formName', i) as string;
					const fromRecordId = requireRecordId(this, i);
					const farRecordId = (
						this.getNodeParameter('farRecordId', i) as string
					)?.trim();
					const throughField = (
						this.getNodeParameter('throughFieldName', i) as string
					)?.trim();
					if (!farRecordId || !throughField) {
						throw new NodeOperationError(
							this.getNode(),
							'Campo through e id record lontano obbligatori.',
							{ itemIndex: i },
						);
					}
					if (operation === 'linkRecords') {
						const linked = await linkThroughRecords.call(
							this,
							entityId,
							formName,
							throughField,
							fromRecordId,
							farRecordId,
						);
						returnData.push({
							json: linked as IDataObject,
							pairedItem: { item: i },
						});
					} else {
						const unlinked = await unlinkThroughRecords.call(
							this,
							entityId,
							formName,
							throughField,
							fromRecordId,
							farRecordId,
						);
						returnData.push({
							json: unlinked as IDataObject,
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (operation === 'resolveRelation') {
					const matchField = this.getNodeParameter('matchField', i) as string;
					const values = parseResolveValues(
						this,
						this.getNodeParameter('resolveValues', i) as string,
						i,
					);
					const resolveOptions = this.getNodeParameter(
						'resolveOptions',
						i,
						{},
					) as IDataObject;
					const fieldName =
						typeof resolveOptions.fieldName === 'string' &&
						resolveOptions.fieldName.trim()
							? resolveOptions.fieldName.trim()
							: undefined;
					const resolved = await resolveNaturalKeys.call(
						this,
						entityId,
						matchField,
						values,
						fieldName,
					);
					const results = (resolved as { results?: unknown[] }).results ?? [
						resolved,
					];
					for (const row of results) {
						returnData.push({
							json: row as IDataObject,
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (!fieldMapperOps.has(operation)) {
					throw new NodeOperationError(
						this.getNode(),
						`Operazione non supportata: ${operation}`,
						{ itemIndex: i },
					);
				}

				const formName = this.getNodeParameter('formName', i) as string;
				const data = readMappedFieldData(this, items, i);

				if (operation === 'create') {
					const result = await createRecord.call(
						this,
						entityId,
						formName,
						data,
					);
					returnData.push({
						json: { id: result.id },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'validateDraft') {
					const validateOpts = this.getNodeParameter(
						'validateDraftOptions',
						i,
						{},
					) as IDataObject;
					const existingId =
						typeof validateOpts.recordId === 'string' &&
						validateOpts.recordId.trim()
							? validateOpts.recordId.trim()
							: undefined;
					const result = await validateDraft.call(
						this,
						entityId,
						formName,
						data,
						existingId,
					);
					returnData.push({
						json: result as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'upsert') {
					const matchField = this.getNodeParameter('matchField', i) as string;
					if (!matchField?.trim()) {
						throw new NodeOperationError(
							this.getNode(),
							'Campo match obbligatorio.',
							{ itemIndex: i },
						);
					}
					const result = await upsertRecord.call(
						this,
						entityId,
						formName,
						matchField.trim(),
						data,
					);
					returnData.push({
						json: result as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'update') {
					if (Object.keys(data).length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Compila almeno un campo da aggiornare.',
							{ itemIndex: i },
						);
					}
					const recordId = requireRecordId(this, i);
					const updateOptions = this.getNodeParameter(
						'updateOptions',
						i,
						{},
					) as IDataObject;
					const expected =
						typeof updateOptions.expectedUpdatedAt === 'string' &&
						updateOptions.expectedUpdatedAt.trim()
							? updateOptions.expectedUpdatedAt.trim()
							: undefined;
					const multiValueModes = parseMultiValueModes(
						updateOptions.multiValueModes,
					);

					const result = await updateRecord.call(
						this,
						entityId,
						recordId,
						formName,
						data,
						expected,
						multiValueModes,
					);
					returnData.push({
						json: { id: result.id },
						pairedItem: { item: i },
					});
					continue;
				}
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
				throw error;
			}
		}

		return [returnData];
	}
}

function requireRecordId(ctx: IExecuteFunctions, itemIndex: number): string {
	const recordId = (ctx.getNodeParameter('recordId', itemIndex) as string)?.trim();
	if (!recordId) {
		throw new NodeOperationError(ctx.getNode(), 'Id record obbligatorio.', {
			itemIndex,
		});
	}
	return recordId;
}

function readMappedFieldData(
	ctx: IExecuteFunctions,
	items: INodeExecutionData[],
	itemIndex: number,
): IDataObject {
	const mappingMode = ctx.getNodeParameter(
		'fields.mappingMode',
		itemIndex,
	) as string;
	let rawFields: IDataObject = {};
	if (mappingMode === 'defineBelow') {
		rawFields = ctx.getNodeParameter('fields.value', itemIndex, {}) as IDataObject;
	} else if (mappingMode === 'autoMapInputData') {
		rawFields = { ...items[itemIndex].json } as IDataObject;
		delete rawFields.id;
	}
	return pickCompiledFieldValues(rawFields);
}

function parseResolveValues(
	ctx: IExecuteFunctions,
	raw: string,
	itemIndex: number,
): string[] {
	const trimmed = (raw ?? '').trim();
	if (!trimmed) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Valori da risolvere obbligatori.',
			{ itemIndex },
		);
	}
	if (trimmed.startsWith('[')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch {
			throw new NodeOperationError(
				ctx.getNode(),
				'JSON valori non valido.',
				{ itemIndex },
			);
		}
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'JSON valori deve essere un array.',
				{ itemIndex },
			);
		}
		return parsed.map((v) => String(v).trim()).filter(Boolean);
	}
	return trimmed
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

async function buildMapperFields(
	this: ILoadOptionsFunctions,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields> {
	const entityId = this.getNodeParameter('entityId') as string;
	const formName = this.getNodeParameter('formName') as string;
	if (!entityId || !formName) {
		return { fields: [] };
	}

	const schema = (await getWriteSchema.call(
		this,
		entityId,
		formName,
	)) as WriteDiscoverySchema;

	const fields = writeSchemaToMapperFields(schema, mode);

	// Single relations: dropdown when candidates fit under RELATION_DROPDOWN_LIMIT.
	// Multi_select stays array (UUID[]); browse all via operation «Cerca relazione».
	for (const field of fields) {
		const schemaField = schema.fields.find((f) => f.name === field.id);
		if (!schemaField || schemaField.input.mode !== 'relation') continue;

		try {
			const records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				field.id,
				RELATION_DROPDOWN_LIMIT,
			);
			if (schemaField.input.multi_select) {
				if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
					const preview = records
						.slice(0, 8)
						.map((r) => `${r.label} (${r.id})`)
						.join('; ');
					field.description = [
						field.description,
						`Anteprima candidati: ${preview}${records.length > 8 ? '…' : ''}. Usa «Cerca relazione» per filtrare.`,
					]
						.filter(Boolean)
						.join(' ');
				} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
					field.description = [
						field.description,
						`≥${RELATION_DROPDOWN_LIMIT} candidati: operazione «Cerca relazione» (q + limit fino a ${RELATION_SEARCH_MAX_LIMIT}), poi UUID[] nei campi.`,
					]
						.filter(Boolean)
						.join(' ');
				}
				continue;
			}

			if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
				field.type = 'options';
				field.options = records.map((r) => ({
					name: r.label,
					value: r.id,
				}));
			} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
				field.description = [
					field.description,
					`Troppi record per la tendina (cap ${RELATION_DROPDOWN_LIMIT}): usa «Cerca relazione» o incolla l’UUID.`,
				]
					.filter(Boolean)
					.join(' ');
			}
		} catch {
			// Keep as free-text UUID / array field.
		}
	}

	return { fields };
}

function parseMultiValueModes(
	raw: unknown,
): Record<string, 'add' | 'replace' | 'remove'> | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const entries = (raw as { entry?: unknown }).entry;
	const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
	const out: Record<string, 'add' | 'replace' | 'remove'> = {};
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const field = String((item as { field?: unknown }).field ?? '').trim();
		const mode = String((item as { mode?: unknown }).mode ?? '').trim();
		if (!field) continue;
		if (mode === 'add' || mode === 'replace' || mode === 'remove') {
			out[field] = mode;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
