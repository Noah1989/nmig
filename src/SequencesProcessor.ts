/*
 * This file is a part of "NMIG" - the database migration tool.
 *
 * Copyright (C) 2016 - present, Anatoly Khaytovich <anatolyuss@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program (please see the "LICENSE.md" file).
 * If not, see <http://www.gnu.org/licenses/gpl.txt>.
 *
 * @author Anatoly Khaytovich <anatolyuss@gmail.com>
 */
import { PoolClient } from 'pg';

import { log } from './FsOps';
import Conversion from './Conversion';
import DBAccess from './DBAccess';
import DBVendors from './DBVendors';
import DBAccessQueryResult from './DBAccessQueryResult';
import IDBAccessQueryParams from './IDBAccessQueryParams';
import * as extraConfigProcessor from './ExtraConfigProcessor';
import { getUniqueIdentifier } from './Utils';

/**
 * Returns sequence name by table's name and column's name.
 * Note, "{table_name}_{column_name}_seq" is a standard PostgreSQL's template to generate sequence names.
 */
const getSequenceName = (tableName: string, columnName: string): string => {
    const sequenceName = `${ tableName }_${ columnName }_seq`;
    return getUniqueIdentifier(sequenceName, '_seq');
};

/**
 * Sets sequence value.
 */
export const setSequenceValue = async (conversion: Conversion, tableName: string): Promise<void> => {
    const originalTableName: string = extraConfigProcessor.getTableName(conversion, tableName, true);
    const autoIncrementedColumn: any = conversion._dicTables[tableName].arrTableColumns.find((column: any) => column.Extra === 'auto_increment');

    if (!autoIncrementedColumn) {
        // No auto-incremented column found.
        return;
    }

    const logTitle: string = 'SequencesProcessor::setSequenceValue';
    const columnName: string = extraConfigProcessor.getColumnName(conversion, originalTableName, autoIncrementedColumn.Field, false);
    const seqName: string = getSequenceName(tableName, columnName);
    const sql: string = `SELECT SETVAL(\'"${ conversion._schema }"."${ seqName }"\', 
                (SELECT MAX("${ columnName }") FROM "${ conversion._schema }"."${ tableName }"));`;

    const params: IDBAccessQueryParams = {
        conversion: conversion,
        caller: logTitle,
        sql: sql,
        vendor: DBVendors.PG,
        processExitOnError: false,
        shouldReturnClient: false
    };

    const result: DBAccessQueryResult = await DBAccess.query(params);

    if (!result.error) {
        const successMsg: string = `\t--[${ logTitle }] Sequence "${ conversion._schema }"."${ seqName }" value is set...`;
        log(conversion, successMsg, conversion._dicTables[tableName].tableLogPath);
    }
};

/**
 * Defines which column in given table has the "auto_increment" attribute.
 * Creates an appropriate identity.
 */
export const createIdentity = async (conversion: Conversion, tableName: string): Promise<void> => {
    const originalTableName: string = extraConfigProcessor.getTableName(conversion, tableName, true);
    const autoIncrementedColumn: any = conversion._dicTables[tableName].arrTableColumns.find((column: any) => column.Extra === 'auto_increment');

    if (!autoIncrementedColumn) {
        // No auto-incremented column found.
        return;
    }

    const columnName: string = extraConfigProcessor.getColumnName(conversion, originalTableName, autoIncrementedColumn.Field, false);
    const logTitle: string = 'SequencesProcessor::createIdentity';
    const seqName: string = getSequenceName(tableName, columnName);
    const sql: string = `ALTER TABLE "${ conversion._schema }"."${ tableName }" ALTER COLUMN "${ columnName }" ADD GENERATED BY DEFAULT AS IDENTITY;`;
    const params: IDBAccessQueryParams = {
        conversion: conversion,
        caller: logTitle,
        sql: sql,
        vendor: DBVendors.PG,
        processExitOnError: false,
        shouldReturnClient: true
    };

    const createSequenceResult: DBAccessQueryResult = await DBAccess.query(params);

    if (createSequenceResult.error) {
        DBAccess.releaseDbClient(conversion, <PoolClient>createSequenceResult.client);
        return;
    }

    params.client = createSequenceResult.client;
    params.shouldReturnClient = false;
    params.sql = `SELECT SETVAL(\'"${ conversion._schema }"."${ seqName }"\', (SELECT MAX("${ columnName }") FROM "${ conversion._schema }"."${ tableName }"));`;

    const sqlSetSequenceValueResult: DBAccessQueryResult = await DBAccess.query(params);

    if (!sqlSetSequenceValueResult.error) {
        const successMsg: string = `\t--[${ logTitle }] Added IDENTITY for "${ conversion._schema }"."${ tableName }"."${ columnName }"...`;
        log(conversion, successMsg, conversion._dicTables[tableName].tableLogPath);
    }
};
