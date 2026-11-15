import type { INodeProperties } from 'n8n-workflow';

import { commonFields } from './common';
import { documentFields } from './document';
import { notificationFields } from './notification';
import { operationPropertiesByResource, resourceProperty } from './operations';
import { recordFields } from './record';
import { relationFields } from './relation';
import { workflowFields } from './workflow';

/** Node parameters in editor order: resource, operation, shared fields, then each resource's own. */
export const cervioProperties: INodeProperties[] = [
	resourceProperty,
	...operationPropertiesByResource,
	...commonFields,
	...recordFields,
	...relationFields,
	...documentFields,
	...workflowFields,
	...notificationFields,
];
