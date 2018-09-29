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
import * as fs from 'fs';
import { log } from './FsOps';
import Conversion from './Conversion';

/**
 * Writes a ditailed error message to the "/errors-only.log" file
 */
export default (conversion: Conversion, message: string, sql: string = ''): void => {
    message += `\n\n\tSQL: ${sql}\n\n`;
    const buffer: Buffer = Buffer.from(message, conversion._encoding);
    log(conversion, message, undefined, true);

    fs.open(conversion._errorLogsPath, 'a', conversion._0777, (error: Error, fd: number) => {
        if (!error) {
            fs.write(fd, buffer, 0, buffer.length, null, () => {
                fs.close(fd, () => {
                    // Each async function MUST have a callback (according to Node.js >= 7).
                });
            });
        }
    });
}
