# Neo4j Schema

## Common Node Properties
- `id` - string - unique identifier for a node. Will be in the form of
  `{nodeType}_{n+}`. Examples: `CompilationUnit_1`,
  `FieldLevelBusinessFunction_102`,...
- `name` - string - The 'user friendly' name for a specific entity. Example: {id: 'CompilationUnit_1', 'name':'pciclite'}

## Core Node Types

### Files & Data Structure

- **DataFile** - Contains records of structured data
  - Properties: `name, dataFileType, id`
- **Record** - Row-level data within a DataFile
  - Properties: `id, name`
- **SourceFile** - Source code files
  - Properties: `id, name, filePath, fileType`

### Field Hierarchy (Recursive Tree Structure)

- **Field** - Base type for all field types
  - Properties: `id, dataType, name`
  - **ElementalField** - Leaf nodes (primitive data fields)
    - Properties: `id, dataType, name`
    - Common data types: `STRING`, `NUMBER`
  - **GroupField** - Container nodes (MUST have at least one HAS_FIELD relationship)
    - Properties: `name, id` (no dataType property)
    - Used to organize related fields hierarchically

### Business Logic

- **BusinessFunction** - Base type for business logic
  - Properties: `id, outputGroup, outputName, isPassthrough, name`
  - **FieldLevelBusinessFunction** - Field-specific business logic
    - Properties: `id, outputGroup, outputName, isPassthrough, name`

### Organization

- **CompilationUnit** - Top-level container for all components (user may call this an `app`, `application`, `program`)
  - Properties: `id, analysisVersion, name`
- **Module** - Logical grouping of a primary source file (usually .cob or .cbl), and the copybooks, sql includes, or other source code dependencies
  - Properties: `id, name`

### For Base Classes

- Always use `(f:Field)` to match GroupFields and/or ElementalFields. Never scan for GroupFields or ElementalFields unless the user specifies a fieldType in their question.
- Use `(bf:BusinessFunction)` to match both BusinessFunction and FieldLevelBusinessFunction. Never scan for FieldLevelBusinessFunctions unless the user specifies a businessFunctionType in their question.

## Key Relationships

### Data Flow Hierarchy

```
DataFile -[:HAS_RECORD]-> Record -[:HAS_FIELD*0..]-> Field
```

### Field Recursive Structure

```
Field -[:HAS_FIELD*0..]-> Field  (recursive - GroupFields contain other fields, some are ElementalFields)
GroupField -[:HAS_FIELD*0..]-> Field
```

### Business Function Relationships

```
BusinessFunction -[:HAS_INPUT_FIELD]-> Field
BusinessFunction -[:HAS_OUTPUT_FIELD]-> Field
BusinessFunction -[:WRITES_IN]-> Module
```

### Organizational Structure

```
CompilationUnit -[:HAS_MODULE]-> Module
CompilationUnit -[:HAS_BUSINESS_FUNCTION]-> BusinessFunction
CompilationUnit -[:HAS_SOURCE_FILE]-> SourceFile
```

### Module Connections

```
Module -[:CONTRIBUTES_TO_BUSINESS_FUNCTION]-> BusinessFunction
Module -[:HAS_INPUT_FILE]-> DataFile
Module -[:HAS_OUTPUT_FILE]-> DataFile
Module -[:HAS_PRIMARY_SOURCE_FILE]-> SourceFile
Module -[:HAS_INCLUDED_SOURCE_FILE]-> SourceFile
```

### For Field Hierarchies

Use recursive patterns to traverse nested field structures:

```cypher
MATCH (record:Record)-[:HAS_FIELD*0..]->(field:Field)
```

### For Nested Record Structure

Get records with their grouped and non-grouped fields:

```cypher
MATCH (record:Record)
OPTIONAL MATCH (record)-[:HAS_FIELD]->(groupField:GroupField)
OPTIONAL MATCH (groupField)-[:HAS_FIELD]->(groupedElemental:ElementalField)
WITH record, groupField, collect(groupedElemental) as elementalFields
WITH record,
     collect(CASE
       WHEN groupField IS NOT NULL THEN {
         id: groupField.id,
         name: groupField.name,
         type: 'GroupField',
         elementalFields: elementalFields
       }
       ELSE null
     END) as groupFieldsWithElements
OPTIONAL MATCH (record)-[:HAS_FIELD]->(directElemental:ElementalField)
WHERE NOT EXISTS((:GroupField)-[:HAS_FIELD]->(directElemental))
WITH record, groupFieldsWithElements, collect(directElemental) as directElementalFields
RETURN {
  id: record.id,
  name: record.name,
  type: 'Record',
  fields: [...directElementalFields, gf IN groupFieldsWithElements WHERE gf IS NOT NULL],

} as nested_record
```

### For DataFile Hierarchies

Whenever a query would include the `DataFile` class, always include the full heirarchy for the data file
Get DataFiles with their complete record and field structure:

```cypher
MATCH (dataFile:DataFile)
OPTIONAL MATCH (dataFile)-[:HAS_RECORD]->(record:Record)
OPTIONAL MATCH (record)-[:HAS_FIELD]->(groupField:GroupField)
OPTIONAL MATCH (groupField)-[:HAS_FIELD]->(groupedElemental:ElementalField)
WITH dataFile, record, groupField, collect(groupedElemental) as elementalFields
WITH dataFile, record,
     collect(CASE
       WHEN groupField IS NOT NULL THEN {
         id: groupField.id,
         name: groupField.name,
         type: 'GroupField',
         elementalFields: elementalFields
       }
       ELSE null
     END) as groupFieldsWithElements
OPTIONAL MATCH (record)-[:HAS_FIELD]->(directElemental:ElementalField)
WHERE NOT EXISTS((:GroupField)-[:HAS_FIELD]->(directElemental))
WITH dataFile, record, groupFieldsWithElements, collect(directElemental) as directElementalFields
WITH dataFile, collect({
  id: record.id,
  name: record.name,
  type: 'Record',
  groupFields: [gf IN groupFieldsWithElements WHERE gf IS NOT NULL],
  elementalFields: directElementalFields
}) as records
RETURN {
  id: dataFile.id,
  name: dataFile.name,
  dataFileType: dataFile.dataFileType,
  type: 'DataFile',
  records: records
} as nested_datafile
```

### For Aggregations

Always use `WITH` clause when mixing aggregation functions with non-aggregated expressions:

```cypher
MATCH (n)-[r]->(m)
WITH n, collect(m) as related
RETURN n.name, related
```
