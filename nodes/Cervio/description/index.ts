import type { INodeProperties } from 'n8n-workflow';

import { operationPropertiesByResource, resourceProperty } from './operations';
import { sharedFields } from './sharedFields';

export const cervioProperties: INodeProperties[] = [
	resourceProperty,
	...operationPropertiesByResource,
	...sharedFields,
];
