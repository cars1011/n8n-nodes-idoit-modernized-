import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

type IdoitContext = IExecuteFunctions | ILoadOptionsFunctions;

interface IdoitCredentials {
	host: string;
	apikey: string;
	useLogin?: boolean;
	username?: string;
	password?: string;
	allowUnauthorizedCerts?: boolean;
}

/**
 * Performs a single JSON-RPC 2.0 call against the i-doit API.
 * `sessionId`, when provided, is sent as the X-RPC-Auth-Session header so that
 * the API key/credentials don't have to be re-sent (and re-validated) with
 * every single call - recommended by i-doit for anything beyond a handful of
 * requests per execution.
 */
export async function idoitApiRequest(
	this: IdoitContext,
	method: string,
	params: IDataObject = {},
	sessionId?: string,
	itemIndex = 0,
): Promise<IDataObject> {
	const credentials = (await this.getCredentials('idoitApi')) as unknown as IdoitCredentials;

	if (!credentials.host) {
		throw new NodeOperationError(this.getNode(), 'No host configured on the i-doit credentials', {
			itemIndex,
		});
	}

	const body: IDataObject = {
		jsonrpc: '2.0',
		method,
		params: {
			...params,
			// The API key always has to be present, even when a session is used.
			apikey: credentials.apikey,
		},
		id: 1,
	};

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${credentials.host.replace(/\/+$/, '')}/src/jsonrpc.php`,
		headers: {
			Accept: 'application/json',
			...(sessionId ? { 'X-RPC-Auth-Session': sessionId } : {}),
		},
		body,
		json: true,
		skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
	};

	let response: IDataObject;
	try {
		response = (await this.helpers.httpRequest(options)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	// i-doit answers JSON-RPC errors with HTTP 200 and an "error" object in
	// the body, so this needs an explicit check rather than relying on a
	// thrown HTTP error.
	if (response?.error) {
		const rpcError = response.error as IDataObject;
		throw new NodeApiError(
			this.getNode(),
			{
				message: rpcError.message ?? null,
				data: rpcError.data ?? null,
				code: rpcError.code ?? null,
			} as JsonObject,
			{
				itemIndex,
				message: `i-doit API error: ${rpcError.message ?? 'Unknown error'}`,
			},
		);
	}

	return response;
}

/**
 * Opens an i-doit session using idoit.login. Only useful/necessary when a
 * dedicated user account is configured on the credentials; the returned
 * session id lets subsequent calls skip re-authentication.
 */
export async function idoitLogin(this: IdoitContext): Promise<string | undefined> {
	const credentials = (await this.getCredentials('idoitApi')) as unknown as IdoitCredentials;

	if (!credentials.useLogin || !credentials.username) {
		return undefined;
	}

	const response = await idoitApiRequest.call(this, 'idoit.login', {
		username: credentials.username,
		password: credentials.password,
	});

	return (response.result as IDataObject)?.['session-id'] as string | undefined;
}

/**
 * Closes an i-doit session opened with idoitLogin. Failures here are
 * swallowed (session timeouts on their own anyway) so they don't mask the
 * actual workflow result.
 */
export async function idoitLogout(this: IdoitContext, sessionId?: string): Promise<void> {
	if (!sessionId) return;

	try {
		await idoitApiRequest.call(this, 'idoit.logout', {}, sessionId);
	} catch {
		// Intentionally ignored - logout best-effort only.
	}
}
