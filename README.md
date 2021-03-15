# Sequelize Query Parser

Simple, powerful, minimalist package to turn your [Node.js](https://nodejs.org) with [Sequelize](http://sequelize.org) RESTful APIs into [Graph APIs](https://zapier.com/engineering/graph-apis/).

```js
// Pass `db` connection object which has `Sequelize.Op`
const queryParser = require("sequelize-query")(db);

getUsers = async req => {
    // Parse your API query
    let query = await queryParser.parse(req);

    // Pass to Sequelize model find...() functions
    return User.findAndCountAll(query);
};
```

## Features and Syntax with examples

- Request specific set of fields instead of fetching all the table columns
```js
// fields=field01,field02...

// E.g: Get only id, name and email
?fields=id,name,email
```

- GET collection request APIs pagination support by default (without you writing code for that)
```js
?offset=0&limit=10
// NOTE: Max page size limit is set to 200
```

- GET collection request APIs sorting and groupping by default.
> Sorting
```js
// Sort by id in ascending order
?sort_by=id.asc

// Sort by name in descending order
?sort_by=name.desc
```

> Grouping
```js
// Group by id
?group_by=id
```

- Simple filter query operations on the request objects
```js
// Query format is
// filedName=unaryOperator:value

// Get all entries where firstName is like Reza or Rezaul, etc
?firstName=like:Reza%

// Get all entries where id is greater than 2 and lastName is like Reza%
?firstName=like:Reza%&id=gt:1
```

- Querying with sequelize JSON format
```js
// Find where firstname is Twaha and id is 1 or firstName is Riajul and id is 2
?query={"or": [{"and": [{"firstName": "Twaha"}, {"id": 1}]}, {"and": [{"firstName": "Riajul"}, {"id": 2}]}]}
// NOTE: query maps your query object to `where=queryObj`
```

- Fetch and Query on relational objects (tables)
```js
// Get only those whose role is 'admin'
?include={"model": "UserRole", "as": "userRole", "include" : {"model": "Role", "as" : "role", "required": 1, "where": {"name": "admin"} }}
```

## Operators

Just use sequelize format query in the API requests  
substituting Sequelize operators with below keys.

```
gt: Op.gt,                      // gt (greater than) for Op.gt
gte: Op.gte,
lt: Op.lt,
lte: Op.lte,
ne: Op.ne,
eq: Op.eq,
not: Op.not,
like: Op.like,                  // LIKE '%hat'
notLike: Op.notLike,            // NOT LIKE '%hat'
regexp: Op.regexp,              // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
notRegexp: Op.notRegexp,        // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
and: Op.and,                    // AND (a = 5)
or: Op.or,                      // (a = 5 OR a = 6)
between: Op.between,            // BETWEEN 6 AND 10
notBetween: Op.notBetween,      // NOT BETWEEN 11 AND 15
in: Op.in,                      // IN [1, 2]
notIn: Op.notIn,                // NOT IN [1, 2]
```
## Installation

```
npm i sequelize-query
```

## Contributing

I really appreciate your help in any case.  
Fixes, Improvements, Enhancements, Documentation.

To contribute, please create a pull request to `develop` branch.
