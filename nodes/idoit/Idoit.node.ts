import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { idoitApiRequest, idoitLogin, idoitLogout } from './GenericFunctions';

export class Idoit implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'i-doit',
		name: 'idoit',
		icon: 'file:idoit.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Read and write data in an i-doit CMDB via its JSON-RPC API',
		defaults: { name: 'i-doit' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'idoitApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'CMDB Category', value: 'cmdbCategory' },
					{ name: 'CMDB Dialog', value: 'cmdbDialog' },
					{ name: 'CMDB Object', value: 'cmdbObject' },
					{ name: 'CMDB Objects (List)', value: 'cmdbObjects' },
					{ name: 'CMDB Object Type Categories', value: 'cmdbObjectTypeCategories' },
					{ name: 'Constants', value: 'idoitConstants' },
					{ name: 'Search', value: 'idoitSearch' },
					{ name: 'Version', value: 'idoitVersion' },
				],
				default: 'cmdbObject',
			},

			// ---------- Operations ----------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['cmdbObject', 'cmdbCategory'] } },
				options: [
					{ name: 'Archive', value: 'archive', description: 'Archive a record', action: 'Archive a record' },
					{ name: 'Create', value: 'create', description: 'Create a record', action: 'Create a record' },
					{ name: 'Delete', value: 'delete', description: 'Mark a record as deleted', action: 'Mark a record as deleted' },
					{ name: 'Purge', value: 'purge', description: 'Permanently delete a record from the database', action: 'Purge a record' },
					{ name: 'Read', value: 'read', description: 'Retrieve a record', action: 'Read a record' },
					{ name: 'Recycle', value: 'recycle', description: 'Recycle a previously archived/deleted record', action: 'Recycle a record' },
					{ name: 'Update', value: 'update', description: 'Update a record', action: 'Update a record' },
				],
				default: 'read',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['cmdbDialog'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create a dialog entry' },
					{ name: 'Delete', value: 'delete', action: 'Delete a dialog entry' },
					{ name: 'Read', value: 'read', action: 'Read a dialog entry' },
					{ name: 'Update', value: 'update', action: 'Update a dialog entry' },
				],
				default: 'read',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['cmdbObjectTypeCategories'] } },
				options: [{ name: 'Read', value: 'read', action: 'Read object type categories' }],
				default: 'read',
			},

			// ---------- Shared fields ----------
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getCategories' },
				displayOptions: { show: { resource: ['cmdbCategory', 'cmdbObjects', 'cmdbDialog'] } },
				default: 'no',
				description: 'The category to work with',
			},
			{
				displayName: 'Object Type',
				name: 'type',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getObjectTypes' },
				displayOptions: { show: { resource: ['cmdbObjects', 'cmdbObject'] } },
				default: '',
				description: 'e.g. Server or Switch',
			},
			{
				displayName: 'Object ID',
				name: 'id',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['read', 'update', 'delete', 'archive', 'recycle', 'purge', 'create'],
						resource: ['cmdbObject', 'cmdbObjectTypeCategories'],
					},
				},
				default: '',
				required: true,
				description: 'ID of the object',
			},
			{
				// Separate definition for cmdbCategory so the "Object ID" label/description
				// stays correct for every operation on that resource (including "create").
				displayName: 'Object ID',
				name: 'id',
				type: 'string',
				displayOptions: { show: { resource: ['cmdbCategory'] } },
				default: '',
				required: true,
				description: 'ID of the object the category entry belongs to',
			},
			{
				displayName: 'Category Entry ID',
				name: 'cateid',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['delete', 'archive', 'recycle', 'purge'],
						resource: ['cmdbCategory'],
					},
				},
				default: '',
				required: true,
				description: 'ID of the category entry, e.g. 3',
			},
			{
				displayName: 'Search String',
				name: 'searchstring',
				type: 'string',
				displayOptions: { show: { resource: ['idoitSearch', 'cmdbObjects'] } },
				default: '',
				description: 'Search over everything, or filter objects by title',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				displayOptions: { show: { operation: ['create', 'update'], resource: ['cmdbObject'] } },
				default: '',
				required: true,
				description: 'Object title',
			},
			{
				displayName: 'Property',
				name: 'property',
				type: 'string',
				displayOptions: { show: { operation: ['read', 'create', 'update'], resource: ['cmdbDialog'] } },
				default: '',
				required: true,
				description: 'Attribute inside the category',
			},
			{
				displayName: 'Values to Set',
				name: 'values',
				placeholder: 'Add Value',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				description: 'Attribute values to write to the category entry',
				default: {},
				displayOptions: { show: { operation: ['create', 'update'], resource: ['cmdbCategory'] } },
				options: [
					{
						name: 'attributes',
						displayName: 'Attributes',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Attribute key' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '', description: 'Value to set' },
						],
					},
				],
			},
			{
				displayName: 'Split Into Separate Items',
				name: 'split',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['cmdbCategory', 'idoitSearch', 'cmdbObjects'],
					},
					hide: { operation: ['create', 'update', 'delete', 'archive', 'recycle', 'purge'] },
				},
				default: true,
				description: 'Whether to split a returned data array into one n8n item per entry, instead of one item holding the whole array',
			},
		],
	};

	methods = {
		loadOptions: {
			async getObjectTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const data = await idoitApiRequest.call(this, 'idoit.constants');
				const objectTypes = ((data.result as IDataObject).objectTypes ?? {}) as IDataObject;

				return Object.entries(objectTypes)
					.map(([key, value]) => ({ name: `${value} (${key})`, value: key }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},

			async getCategories(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const data = await idoitApiRequest.call(this, 'idoit.constants');
				const categories = (data.result as IDataObject).categories as IDataObject;

				const section = (group: IDataObject, label: string): INodePropertyOptions[] => [
					{ name: `--- ${label} ---`, value: '' },
					...Object.entries(group)
						.map(([key, value]) => ({ name: `${value} (${key})`, value: key }))
						.sort((a, b) => a.name.localeCompare(b.name)),
				];

				return [
					{ name: 'No Category', value: 'no' },
					...section(categories.g as IDataObject, 'Global Categories'),
					...section(categories.s as IDataObject, 'Specific Categories'),
					...section(categories.g_custom as IDataObject, 'Custom Categories'),
				];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Authenticate once per execution (only relevant if the credentials use
		// a dedicated login) instead of once per item/API call.
		const sessionId = await idoitLogin.call(this);

		const pushResult = (data: IDataObject, split: boolean, pairedItem: number) => {
			if (split && Array.isArray(data.result)) {
				for (const entry of data.result as IDataObject[]) {
					returnData.push({ json: entry, pairedItem });
				}
			} else {
				returnData.push({ json: data, pairedItem });
			}
		};

		try {
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex, 'read') as string;

				try {
					if (resource === 'idoitVersion' || resource === 'idoitConstants') {
						const method = resource === 'idoitVersion' ? 'idoit.version' : 'idoit.constants';
						const data = await idoitApiRequest.call(this, method, {}, sessionId, itemIndex);
						returnData.push({ json: data, pairedItem: itemIndex });
						continue;
					}

					if (resource === 'idoitSearch') {
						const searchstring = this.getNodeParameter('searchstring', itemIndex, '') as string;
						const split = this.getNodeParameter('split', itemIndex, true) as boolean;
						const data = await idoitApiRequest.call(
							this,
							'idoit.search',
							{ q: searchstring },
							sessionId,
							itemIndex,
						);
						pushResult(data, split, itemIndex);
						continue;
					}

					if (resource === 'cmdbObjectTypeCategories') {
						const id = this.getNodeParameter('id', itemIndex, '') as string;
						const data = await idoitApiRequest.call(
							this,
							'cmdb.object_type_categories.read',
							{ id },
							sessionId,
							itemIndex,
						);
						returnData.push({ json: data, pairedItem: itemIndex });
						continue;
					}

					if (resource === 'cmdbObjects') {
						const type = this.getNodeParameter('type', itemIndex, '') as string;
						const category = this.getNodeParameter('category', itemIndex, 'no') as string;
						const searchstring = this.getNodeParameter('searchstring', itemIndex, '') as string;
						const split = this.getNodeParameter('split', itemIndex, true) as boolean;

						const params: IDataObject = {
							filter: { type, title: searchstring },
							order_by: 'title',
							sort: 'ASC',
						};
						if (category !== 'no' && category !== '') {
							// Bug fix vs. the original node: this used to embed a literal,
							// non-interpolated `'`${category}`'` string here.
							params.categories = [category];
						}

						const data = await idoitApiRequest.call(this, 'cmdb.objects.read', params, sessionId, itemIndex);
						pushResult(data, split, itemIndex);
						continue;
					}

					if (resource === 'cmdbDialog') {
						const category = this.getNodeParameter('category', itemIndex, '') as string;
						const property = this.getNodeParameter('property', itemIndex, '') as string;
						const data = await idoitApiRequest.call(
							this,
							`cmdb.dialog.${operation}`,
							{ category, property },
							sessionId,
							itemIndex,
						);
						returnData.push({ json: data, pairedItem: itemIndex });
						continue;
					}

					if (resource === 'cmdbObject') {
						const id = this.getNodeParameter('id', itemIndex, '') as string;

						if (operation === 'read') {
							const data = await idoitApiRequest.call(this, 'cmdb.object.read', { id }, sessionId, itemIndex);
							returnData.push({ json: data, pairedItem: itemIndex });
						} else if (operation === 'create') {
							const type = this.getNodeParameter('type', itemIndex, '') as string;
							const title = this.getNodeParameter('title', itemIndex, '') as string;
							const data = await idoitApiRequest.call(
								this,
								'cmdb.object.create',
								{
									type,
									title,
									purpose: 'production',
									cmdb_status: 'C__CMDB_STATUS__IN_OPERATION',
									description: 'created by n8n',
								},
								sessionId,
								itemIndex,
							);
							returnData.push({ json: data, pairedItem: itemIndex });
						} else if (operation === 'update') {
							const title = this.getNodeParameter('title', itemIndex, '') as string;
							const data = await idoitApiRequest.call(
								this,
								'cmdb.object.update',
								{ id, title },
								sessionId,
								itemIndex,
							);
							returnData.push({ json: data, pairedItem: itemIndex });
						} else if (operation === 'delete') {
							const data = await idoitApiRequest.call(
								this,
								'cmdb.object.delete',
								{ id, status: 'C__RECORD_STATUS__DELETED' },
								sessionId,
								itemIndex,
							);
							returnData.push({ json: data, pairedItem: itemIndex });
						} else if (['archive', 'recycle', 'purge'].includes(operation)) {
							const data = await idoitApiRequest.call(
								this,
								`cmdb.object.${operation}`,
								{ object: id },
								sessionId,
								itemIndex,
							);
							returnData.push({ json: data, pairedItem: itemIndex });
						}
						continue;
					}

					if (resource === 'cmdbCategory') {
						const id = this.getNodeParameter('id', itemIndex, '') as string;
						const category = this.getNodeParameter('category', itemIndex, '') as string;

						if (operation === 'read') {
							const split = this.getNodeParameter('split', itemIndex, true) as boolean;
							const data = await idoitApiRequest.call(
								this,
								'cmdb.category.read',
								{ objID: id, category },
								sessionId,
								itemIndex,
							);
							pushResult(data, split, itemIndex);
						} else if (operation === 'create' || operation === 'update') {
							const attributesInput = this.getNodeParameter(
								'values.attributes',
								itemIndex,
								[],
							) as IDataObject[];
							const attributeData: IDataObject = {};
							for (const attribute of attributesInput) {
								attributeData[attribute.name as string] = attribute.value;
							}

							const data = await idoitApiRequest.call(
								this,
								'cmdb.category.save',
								{ object: id, category, data: attributeData },
								sessionId,
								itemIndex,
							);
							returnData.push({ json: data, pairedItem: itemIndex });
						} else if (['delete', 'archive', 'recycle', 'purge'].includes(operation)) {
							const cateid = this.getNodeParameter('cateid', itemIndex, '') as string;
							const data = await idoitApiRequest.call(
								this,
								`cmdb.category.${operation}`,
								{ object: id, category, entry: cateid },
								sessionId,
								itemIndex,
							);
							returnData.push({ json: data, pairedItem: itemIndex });
						}
						continue;
					}

					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, { itemIndex });
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { error: (error as Error).message }, pairedItem: itemIndex });
						continue;
					}
					throw error;
				}
			}
		} finally {
			await idoitLogout.call(this, sessionId);
		}

		return [returnData];
	}
}
