/*
 * File: sequelizeQueryParser.js
 * File Created: Wednesday, 17th October 2018 12:18:11 pm
 * Author: Twaha Mukammel (t.mukammel@gmail.com)
 */

'use strict';

const Promise = require('bluebird');

/**
 * Pass `db` connection object which has `Sequelize.Op`
 * @param {*} db
 * @returns object {parse}
 */
module.exports = (db) => {
    const Op = db.Sequelize.Op;

    const operators = {
        gt: Op.gt,
        gte: Op.gte,
        lt: Op.lt,
        lte: Op.lte,
        ne: Op.ne,
        eq: Op.eq,
        not: Op.not,
        like: Op.like, // LIKE '%hat'
        notLike: Op.notLike, // NOT LIKE '%hat'
        // iLike: Op.iLike,                // ILIKE '%hat' (case insensitive) (PG only)
        // notILike: Op.notILike,          // NOT ILIKE '%hat'  (PG only)
        regexp: Op.regexp, // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
        notRegexp: Op.notRegexp, // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
        // iRegexp: Op.iRegexp,            // ~* '^[h|a|t]' (PG only)
        // notIRegexp: Op.notIRegexp       // !~* '^[h|a|t]' (PG only)
        and: Op.and, // AND (a = 5)
        or: Op.or, // (a = 5 OR a = 6)
        between: Op.between, // BETWEEN 6 AND 10
        notBetween: Op.notBetween, // NOT BETWEEN 11 AND 15
        in: Op.in, // IN [1, 2]
        notIn: Op.notIn // NOT IN [1, 2]
        // overlap: Op.overlap,            // && [1, 2] (PG array overlap operator)
        // contains: Op.contains,          // @> [1, 2] (PG array contains operator)
        // contained: Op.contained,        // <@ [1, 2] (PG array contained by operator)
        // col: Op.col                     // = "user"."organization_id", with dialect specific column identifiers, PG in this example
        // any: Op.any                     // ANY ARRAY[2, 3]::INTEGER (PG only)
    };

    /**
     * Split '.' or ',' seperated strings to array
     * @param {JSON} obj
     * @param {array} array
     */
    const splitStringAndBuildArray = (obj, array) => {
        const elements = obj.split(',');

        elements.forEach((element) => {
            const fields = element.split('.');
            
            if (fields && fields.length > 0) {
                array.push(fields);
            }
        });
    };

    /**
     * Parse query params
     * @param {string|Array} query
     * @returns {Array} sequelize formatted DB query array
     */
    const parseFields = (query) => {
        let array = null;

        if (query !== null) {
            array = [];

            if (Array.isArray(query) == true) {
                query.forEach((obj) => {
                    splitStringAndBuildArray(obj, array);
                });
            } else {
                splitStringAndBuildArray(query, array);
            }
        }

        return array;
    };

    /**
     * Replaces operator (json object key) with Sequelize operator.
     * @param {JSON} json
     * @param {string} key
     * @param {Sequelize.op} op
     */
    const replaceKeyWithOperator = (json, key, op) => {
        const value = json[key];
        delete json[key];
        json[op] = value;
    };

    /**
     * Iteratively replace json keys with Sequelize formatted query operators.
     * @param {JSON} json next json
     */
    const iterativeReplace = (json) => {
        Object.keys(json).forEach((key) => {
            if (json[key] !== null && typeof json[key] === 'object') {
                const op = operators[key];

                if (op) {
                    replaceKeyWithOperator(json, key, op);
                    iterativeReplace(json[op]);
                } else {
                    iterativeReplace(json[key]);
                }
            } else if (key == 'model' && db[json[key]] != null) {
                json.model = db[json[key]];
            } else {
                const op = operators[key];
                if (op) replaceKeyWithOperator(json, key, op);
            }
        });
    };

    /**
     * Unescape escaped sequences in string.
     * @param {*} query string with escape sequence
     * @returns {string} unescaped string
     */
    const unescapeEscapedQuery = (query) => {
        const queryString = query.toString();
        return unescape(queryString);
    };

    /**
     * Parse and build Sequelize format query
     * @param {JSON} query
     * @returns {JSON} sequelize formatted DB query params JSON
     */
    const parseQueryFields = (query) => {
        const json = JSON.parse(unescapeEscapedQuery(query));
        iterativeReplace(json);
        return json;
    };

    /**
     * Parse and build Sequelize format query
     * @param {JSON} query
     * @returns {JSON} sequelize formatted DB include params JSON
     */
    const parseIncludeFields = (query) => {
        const json = JSON.parse(unescapeEscapedQuery(query));
        iterativeReplace(json);
        return json;
    };

    /**
     * Parse single query parameter
     * @param {string} query
     * @returns {string|JSON} sequelize formatted DB query param
     */
    const parseQueryParam = (query) => {
        const elements = query.split(/:(.+)/);

        if (elements?.length > 1) {
            const param = {};
            const elementsArray = elements[1].split(',');
            
            if (elementsArray) {
                param[operators[elements[0]]] = elementsArray.length > 1 ? elementsArray : elementsArray[0];
                return param;
            }
        }
        
        return elements[0];
    };

    // Max page size limit is set to 200
    const pageSizeLimit = 200;

    /**
     * Sequelize Query Parser is a very simple package that
     * turns your RESTful APIs into a basic set of Graph APIs.
     *
     * Parses - filter, query, sorting, paging, group, relational object queries
     *
     * fields=field01,field02...
     *
     * limit=value&&offset=value
     *
     * sort_by=field01.asc|field02.desc
     *
     * group_by=field01,field02
     *
     * query=JSON
     *
     * include=JSON
     *
     * filedName=unaryOperator:value
     *
     * @param {JSON} req
     * @returns {JSON} sequelize formatted DB query
     */
    function parse(req) {
        console.debug('Request query: ', req.query);

        return new Promise((resolve, reject) => {
            try {
                let offset = 0;
                let limit = pageSizeLimit;
                const dbQuery = {
                    where: {},
                    offset,
                    limit
                };

                for (const key in req.query) {
                    switch (key) {
                        // Fields
                        case 'fields':
                            // split the field names (attributes) and assign to an array
                            const fields = req.query.fields.split(',');
                            // assign fields array to .attributes
                            if (fields && fields.length > 0) dbQuery.attributes = fields;
                            break;

                        // pagination page size
                        case 'limit':
                            dbQuery.limit = Math.min(Math.max(parseInt(req.query.limit), 1), pageSizeLimit);
                            limit = dbQuery.limit;
                            break;

                        // pagination page offset
                        case 'offset':
                            offset = Math.max(parseInt(req.query.offset), 0);
                            break;

                        // Sort by field order
                        case 'sort_by':
                            dbQuery.order = parseFields(req.query.sort_by);
                            break;

                        // Group by field
                        // TODO: Check array
                        case 'group_by':
                            dbQuery.group = parseFields(req.query.group_by);
                            break;

                        // JSON (nested) query
                        case 'query':
                            const parsed = parseQueryFields(req.query.query);
                            dbQuery.where = { ...dbQuery.where, ...parsed };
                            break;

                        // include and query on associated tables
                        case 'include':
                            dbQuery.include = parseIncludeFields(req.query.include);
                            break;

                        // Simple filter query
                        default:
                            dbQuery.where[key] = parseQueryParam(req.query[key]);
                            break;
                    }
                }

                dbQuery.offset = offset * limit;

                console.debug('Final sequelize query:');
                console.debug(JSON.stringify(dbQuery, null, 4));

                resolve(dbQuery);
            } catch (error) {
                console.debug('Error: ', error.message);
                reject([{ msg: error.message }]);
            }
        });
    }

    return { parse };
};
