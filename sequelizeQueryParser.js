/*
 * File: sequelizeQueryParser.js
 * File Created: Wednesday, 17th October 2018 12:18:11 pm
 * Author: Twaha Mukammel (t.mukammel@gmail.com)
 */

'use strict'

const Promise = require('bluebird');

/**
 * Pass `db` connection object which has `Sequelize.Op`
 * @param {*} db 
 * @returns object {parse}
 */
module.exports = function (db) {
    const Op = db.Sequelize.Op;

    const operations = {
        gt: Op.gt,
        gte: Op.gte,
        lt: Op.lt,
        lte: Op.lte,
        ne: Op.ne,
        eq: Op.eq,
        not: Op.not,
        like: Op.like,                  // LIKE '%hat'
        notLike: Op.notLike,            // NOT LIKE '%hat'
        // iLike: Op.iLike,                // ILIKE '%hat' (case insensitive) (PG only)
        // notILike: Op.notILike,          // NOT ILIKE '%hat'  (PG only)
        regexp: Op.regexp,              // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
        notRegexp: Op.notRegexp,        // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
        // iRegexp: Op.iRegexp,            // ~* '^[h|a|t]' (PG only)
        // notIRegexp: Op.notIRegexp       // !~* '^[h|a|t]' (PG only)
        and: Op.and,                    // AND (a = 5)
        or: Op.or,                      // (a = 5 OR a = 6)
        between: Op.between,            // BETWEEN 6 AND 10
        notBetween: Op.notBetween,      // NOT BETWEEN 11 AND 15
        in: Op.in,                      // IN [1, 2]
        notIn: Op.notIn,                // NOT IN [1, 2]
        // overlap: Op.overlap,            // && [1, 2] (PG array overlap operator)
        // contains: Op.contains,          // @> [1, 2] (PG array contains operator)
        // contained: Op.contained,        // <@ [1, 2] (PG array contained by operator)
        // col: Op.col                     // = "user"."organization_id", with dialect specific column identifiers, PG in this example
        // any: Op.any                     // ANY ARRAY[2, 3]::INTEGER (PG only)
    }
    
    const splitAndBuild = (obj, array) => {
        let elements = obj.split(',');
        
        if (elements && elements.length > 0) {
            elements.forEach(element => {
                var fields = element.split('.');
                if (fields && fields.length > 0) {
                    array.push(fields)
                }
            });
        }
    }
    
    /**
     * Parse query param
     * @param {string|Array} query
     * @returns {Array} sequelize formatted DB query array
     */
    const parseFields = (query) => {
        var array = null;
    
        if (query !== null) {
            array = [];
    
            if (Array.isArray(query) == true) {
                query.forEach(obj => {
                    splitAndBuild(obj, array);
                });
            }
            else {
                splitAndBuild(query, array);
            }
        }
    
        return array;
    }
    
    /**
     * Replaces json object key with Sequelize operation
     * @param {JSON} json 
     * @param {string} key 
     * @param {Sequelize.op} op
     */
    const replaceKey = (json, key, op) => {
        let value = json[key];
        delete json[key];
        json[op] = value;
    }
    
    /**
     * Iteratively replace json keys with Sequelize formated query operations.
     * @param {JSON} json next json
     */
    const iterativeReplace = (json) => {
        Object.keys(json).forEach(function (key) {
            if (json[key] !== null && typeof json[key] === 'object') {
    
                // console.debug("key: ", key);
                let op = operations[key];
                // console.debug("operation: ", op);
    
                if (op) {
                    replaceKey(json, key, op);
                    // console.debug("next: ", JSON.stringify(json[op], null, 4));
                    iterativeReplace(json[op]);
                }
                else {
                    // console.debug("next: ", JSON.stringify(json[key], null, 4));
                    iterativeReplace(json[key]);
                }
            }
            else if (key == 'model' && db[json[key]] != null) {
                // json['as'] = json[key].replace(/^./, char => char.toLowerCase());// /^\w/
                json['model'] = db[json[key]];
            }
            else {
                let op = operations[key];
                if (op) replaceKey(json, key, op);
            }
    
            // console.debug("After Key:", key, " Query fields: ", JSON.stringify(json, null, 4))
        });
    }
    
    /**
     * Parse and build Sequelize format query
     * @param {JSON} query 
     * @returns {JSON} sequelize formatted DB query params JSON
     */
    const parseQueryFields = (query) => {
        let json = JSON.parse(query.toString());
        iterativeReplace(json);
        console.debug("Resultent query fields: ", json);
        return json;
    }
    
    /**
     * Parse and build Sequelize format query
     * @param {JSON} query 
     * @returns {JSON} sequelize formatted DB include params JSON
     */
    const parseIncludeFields = (query) => {
        let json = JSON.parse(query.toString());
        iterativeReplace(json);
        console.debug("Resultent include fields: ", json);
        return json;
    }
    
    /**
     * Parse single query parameter
     * @param {string} query
     * @returns {string|JSON} sequelize formatted DB query param
     */
    const parseQueryParam = (query) => {
        let elements = query.split(':');
        // console.debug("Query param: ", JSON.stringify(elements, null, 4));
        if (elements && elements.length > 1) {
            var param = {};
            param[operations[elements[0]]] = elements[1]
    
            console.debug("Query param: ", param);
            return param;
        }
        else {
            console.debug("Query param: ", elements[0]);
            return elements[0];
        }
    }
    
    const pageSizeLimit = 200;
    
    /**
     * Parse filtering, query, sorting, paging, group queries
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
     * filedName=unaryOperator:value
     * 
     * @param {JSON} req
     * @returns {JSON} sequelize formatted DB query
     */
    function parse(req) {
        console.debug("Request query: ", req.query);
    
        return new Promise((resolve, reject) => {
            try {
                var offset = 0, limit = pageSizeLimit;
                var dbQuery = {
                    where: {}
                };
                const Op = db.Sequelize.Op;
            
                for (const key in req.query) {
                    switch (key) {
                        // Fields
                        case 'fields':
                            let fields = req.query.fields.split(",");
                            if (fields && fields.length > 0) dbQuery.attributes = fields;
                            break;
            
                        case 'limit':
                            // TODO: Define limit configurations
                            dbQuery.limit = Math.min(Math.max(parseInt(req.query.limit), 1), pageSizeLimit);
                            limit = dbQuery.limit;
                            break;
            
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
                            let parsed = parseQueryFields(req.query.query);
                            dbQuery.where = { ...dbQuery.where, ...parsed };
                            break;
    
                        case 'include':
                            dbQuery.include = parseIncludeFields(req.query.include);;
                            break;
            
                        // Simple filter query
                        default:
                            dbQuery.where[key] = parseQueryParam(req.query[key]);
                            break;
                    }
                }
    
                dbQuery.offset = offset * limit;
            
                console.debug("Query: ", JSON.stringify(dbQuery, null, 4));
            
                resolve(dbQuery);
            }
            catch(error) {
                console.debug("Error: ", error.message)
                reject([{msg: error.message}]);
            }
        })
    }
    
    return {
        parse
    }
}
