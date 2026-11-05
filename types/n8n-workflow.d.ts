/**
 * Minimal ambient types for building the community node without compiling
 * n8n-workflow native deps (isolated-vm) on the host Node.
 * At runtime n8n provides the real package.
 */
declare module 'n8n-workflow' {
	export type IDataObject = Record<string, unknown>;
	export type JsonObject = Record<string, unknown>;
	export type IHttpRequestMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

	export interface INodePropertyOptions {
		name: string;
		value: string | number | boolean;
		description?: string;
		action?: string;
	}

	export interface INodeProperties {
		displayName: string;
		name: string;
		type: string;
		default?: unknown;
		description?: string;
		placeholder?: string;
		required?: boolean;
		noDataExpression?: boolean;
		options?: Array<
			| INodePropertyOptions
			| INodeProperties
			| { displayName?: string; name: string; values: INodeProperties[] }
		>;
		values?: INodeProperties[];
		typeOptions?: Record<string, unknown>;
		displayOptions?: {
			show?: Record<string, Array<string | boolean | number>>;
			hide?: Record<string, Array<string | boolean | number>>;
		};
	}

	export interface IAuthenticateGeneric {
		type: 'generic';
		properties: {
			headers?: Record<string, string>;
			qs?: Record<string, string>;
			body?: Record<string, string>;
		};
	}

	export interface ICredentialTestRequest {
		request: {
			baseURL?: string;
			url: string;
			method?: string;
		};
	}

	export type Icon = string | { light: string; dark: string };

	export interface ICredentialType {
		name: string;
		displayName: string;
		icon?: Icon;
		documentationUrl?: string;
		properties: INodeProperties[];
		authenticate?: IAuthenticateGeneric;
		test?: ICredentialTestRequest;
	}

	export interface IHttpRequestOptions {
		method?: IHttpRequestMethods;
		url: string;
		qs?: IDataObject;
		body?: IDataObject | unknown;
		json?: boolean;
		headers?: Record<string, string>;
		baseURL?: string;
	}

	export interface INodeExecutionData {
		json: IDataObject;
		pairedItem?: { item: number } | Array<{ item: number }>;
		binary?: unknown;
	}

	export interface ResourceMapperField {
		id: string;
		displayName: string;
		required: boolean;
		defaultMatch: boolean;
		canBeUsedToMatch?: boolean;
		display: boolean;
		type: string;
		options?: INodePropertyOptions[];
		readOnly?: boolean;
		removed?: boolean;
		description?: string;
	}

	export interface ResourceMapperFields {
		fields: ResourceMapperField[];
	}

	export interface INodeTypeDescription {
		displayName: string;
		name: string;
		icon?: string | { light: string; dark: string };
		group: string[];
		version: number | number[];
		subtitle?: string;
		description: string;
		defaults: { name: string };
		usableAsTool?: boolean;
		inputs: string[] | unknown[];
		outputs: string[] | unknown[];
		credentials?: Array<{
			name: string;
			required?: boolean;
			displayOptions?: INodeProperties['displayOptions'];
		}>;
		properties: INodeProperties[];
		requestDefaults?: Record<string, unknown>;
	}

	export interface INodeType {
		description: INodeTypeDescription;
		methods?: Record<string, Record<string, Function>>;
		execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
	}

	export interface IGetNodeParameterOptions {
		extractValue?: boolean;
		skipValidation?: boolean;
	}

	export interface IExecuteFunctions {
		getInputData(): INodeExecutionData[];
		getNodeParameter(
			parameterName: string,
			itemIndex: number,
			fallbackValue?: unknown,
			options?: IGetNodeParameterOptions,
		): unknown;
		getCredentials(type: string): Promise<IDataObject>;
		getNode(): { name: string; parameters?: IDataObject };
		continueOnFail(): boolean;
		helpers: {
			httpRequestWithAuthentication(
				this: IExecuteFunctions,
				credentialsType: string,
				options: IHttpRequestOptions,
			): Promise<unknown>;
			getBinaryDataBuffer(
				itemIndex: number,
				propertyName: string,
				inputIndex?: number,
			): Promise<Buffer>;
			constructExecutionMetaData(
				inputData: INodeExecutionData[],
				options: { itemData: { item: number } },
			): INodeExecutionData[];
		};
	}

	export interface ILoadOptionsFunctions {
		getNodeParameter(
			parameterName: string,
			fallbackValue?: unknown,
			options?: IGetNodeParameterOptions,
		): unknown;
		getCredentials(type: string): Promise<IDataObject>;
		getNode(): { name: string; parameters?: IDataObject };
		helpers: {
			httpRequestWithAuthentication(
				this: ILoadOptionsFunctions,
				credentialsType: string,
				options: IHttpRequestOptions,
			): Promise<unknown>;
		};
	}

	export type IHookFunctions = ILoadOptionsFunctions;

	export const NodeConnectionTypes: { Main: string };

	export class NodeApiError extends Error {
		constructor(node: unknown, error: JsonObject, options?: unknown);
	}

	export class NodeOperationError extends Error {
		constructor(node: unknown, message: string, options?: { itemIndex?: number; level?: string });
	}
}
