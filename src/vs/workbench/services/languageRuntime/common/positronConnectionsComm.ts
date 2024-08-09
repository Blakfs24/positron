/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2024 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

//
// AUTO-GENERATED from connections.json; do not edit.
//

import { Event } from 'vs/base/common/event';
import { PositronBaseComm, PositronCommOptions } from 'vs/workbench/services/languageRuntime/common/positronBaseComm';
import { IRuntimeClientInstance } from 'vs/workbench/services/languageRuntime/common/languageRuntimeClientInstance';

/**
 * ObjectSchema in Schemas
 */
export interface ObjectSchema {
	/**
	 * Name of the underlying object
	 */
	name: string;

	/**
	 * The object type (table, catalog, schema)
	 */
	kind: string;

}

/**
 * FieldSchema in Schemas
 */
export interface FieldSchema {
	/**
	 * Name of the field
	 */
	name: string;

	/**
	 * The field data type
	 */
	dtype: string;

}

/**
 * Event: Request to focus the Connections pane
 */
export interface FocusEvent {
}

/**
 * Event: Request the UI to refresh the connection information
 */
export interface UpdateEvent {
}

export enum ConnectionsFrontendEvent {
	Focus = 'focus',
	Update = 'update'
}

export enum ConnectionsBackendRequest {
	ListObjects = 'list_objects',
	ListFields = 'list_fields',
	ContainsData = 'contains_data',
	GetIcon = 'get_icon',
	PreviewObject = 'preview_object'
}

export class PositronConnectionsComm extends PositronBaseComm {
	constructor(
		instance: IRuntimeClientInstance<any, any>,
		options?: PositronCommOptions<ConnectionsBackendRequest>,
	) {
		super(instance, options);
		this.onDidFocus = super.createEventEmitter('focus', []);
		this.onDidUpdate = super.createEventEmitter('update', []);
	}

	/**
	 * List objects within a data source
	 *
	 * List objects within a data source, such as schemas, catalogs, tables
	 * and views.
	 *
	 * @param path The path to object that we want to list children.
	 *
	 * @returns Array of objects names and their kinds.
	 */
	listObjects(path: Array<ObjectSchema>): Promise<Array<ObjectSchema>> {
		return super.performRpc('list_objects', ['path'], [path]);
	}

	/**
	 * List fields of an object
	 *
	 * List fields of an object, such as columns of a table or view.
	 *
	 * @param path The path to object that we want to list fields.
	 *
	 * @returns Array of field names and data types.
	 */
	listFields(path: Array<ObjectSchema>): Promise<Array<FieldSchema>> {
		return super.performRpc('list_fields', ['path'], [path]);
	}

	/**
	 * Check if an object contains data
	 *
	 * Check if an object contains data, such as a table or view.
	 *
	 * @param path The path to object that we want to check if it contains
	 * data.
	 *
	 * @returns Boolean indicating if the object contains data.
	 */
	containsData(path: Array<ObjectSchema>): Promise<boolean> {
		return super.performRpc('contains_data', ['path'], [path]);
	}

	/**
	 * Get icon of an object
	 *
	 * Get icon of an object, such as a table or view.
	 *
	 * @param path The path to object that we want to get the icon.
	 *
	 * @returns The icon of the object.
	 */
	getIcon(path: Array<ObjectSchema>): Promise<string> {
		return super.performRpc('get_icon', ['path'], [path]);
	}

	/**
	 * Preview object data
	 *
	 * Preview object data, such as a table or view.
	 *
	 * @param path The path to object that we want to preview.
	 *
	 * @returns undefined
	 */
	previewObject(path: Array<ObjectSchema>): Promise<null> {
		return super.performRpc('preview_object', ['path'], [path]);
	}


	/**
	 * Request to focus the Connections pane
	 */
	onDidFocus: Event<FocusEvent>;
	/**
	 * Request the UI to refresh the connection information
	 */
	onDidUpdate: Event<UpdateEvent>;
}
