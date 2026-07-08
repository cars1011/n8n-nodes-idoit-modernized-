import type {
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class IdoitApi implements ICredentialType {
	name = 'idoitApi';

	displayName = 'i-doit API';

	documentationUrl = 'https://kb.i-doit.com/en/i-doit-add-ons/api/index.html';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://demo.i-doit.com',
			description: 'Base URL of your i-doit instance, without a trailing slash and without /src/jsonrpc.php',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apikey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The API key configured under Administration -> Add-ons -> JSON-RPC API',
		},
		{
			displayName: 'Use Dedicated API User',
			name: 'useLogin',
			type: 'boolean',
			default: false,
			description:
				'Whether to authenticate with a dedicated i-doit user account (recommended). If disabled, the built-in "Api System" user is used.',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			displayOptions: {
				show: { useLogin: [true] },
			},
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: { useLogin: [true] },
			},
		},
		{
			displayName: 'Ignore SSL Certificate Errors',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description:
				'Whether to connect even if the SSL certificate of the i-doit instance cannot be verified. Only use this for trusted internal instances.',
		},
	];

	// Generic auth is not used here because i-doit expects the API key inside
	// the JSON-RPC "params" object rather than as a header/query param. The
	// actual request assembly happens in GenericFunctions.ts. This block is
	// still required by n8n's credential interface, so we keep it a no-op.
	async authenticate(
		credentials: Record<string, unknown>,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		return requestOptions;
	}

	// Lets users hit the "Test" button on the credential without leaving n8n.
	// Calls the parameter-less idoit.version method.
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			baseURL: '={{$credentials.host}}',
			url: '/src/jsonrpc.php',
			body: {
				jsonrpc: '2.0',
				method: 'idoit.version',
				params: {
					apikey: '={{$credentials.apikey}}',
				},
				id: 1,
			},
		},
	};
}
