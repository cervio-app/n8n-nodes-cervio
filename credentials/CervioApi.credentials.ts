import type { IAuthenticateGeneric, Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class CervioApi implements ICredentialType {
	name = 'cervioApi';

	displayName = 'Cervio API';

	icon: Icon = {
		light: 'file:cervio.mono.light.svg',
		dark: 'file:cervio.mono.dark.svg',
	};

	documentationUrl = 'https://github.com/cervio-app/n8n-nodes-cervio#installation';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://acme.cervio.app',
			required: true,
			description: 'Address of your Cervio workspace, e.g. https://acme.cervio.app.',
		},
		{
			displayName: 'Personal Access Token',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'cpat_…',
			description:
				'Create it in Cervio under Admin → API, with the scopes of the operations you use (see the README).',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Accept: 'application/json',
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};
}
