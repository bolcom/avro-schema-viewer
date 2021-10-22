import { Util } from '../shared/util';

export class AvroUtil {
  public static parseAvsc(json): AvroSchema {
    let names = new Names();

    let avroSchema = AvroUtil.makeAvscObject(json, names);
    AvroSchema.assignFullpaths(avroSchema);

    return avroSchema;
  }

  public static getNonPrimitiveSchemas(schemas: AvroSchema[]) {
    return schemas.filter(v => {
      return !(v instanceof PrimitiveSchema);
    });
  }

  public static isNullable(schemas: AvroSchema[]) {
    let isNullable = false;

    schemas.forEach(schema => {
      if (schema instanceof PrimitiveSchema && schema.type === 'null') {
        isNullable = true;
      }
    });

    return isNullable;
  }

  public static getAvroSchemaNodeByFullPath(fullpath: string, schema: SchemaType, index: number = 1): SchemaType {
    if (schema['fullpath'] === fullpath) {
      return schema;
    } else {
      let paths = fullpath.split('.');
      let nextIndex = index + 1;
      let name = paths.slice(0, nextIndex).join('.');

      if (schema instanceof RecordSchema) {
        let matchedFields = schema.fields.filter((f: Field) => f.fullpath === name);
        if (matchedFields.length === 1) {
          if (matchedFields[0].fullpath === fullpath) {
            return matchedFields[0];
          }

          let nextFieldType = (matchedFields[0] as Field).type;

          if (nextFieldType instanceof UnionSchema) {
            let nonPrimitiveAndNonNullSchemas = AvroUtil.getNonPrimitiveSchemas(nextFieldType.schemas);

            if (nonPrimitiveAndNonNullSchemas.length === 1) {
              return AvroUtil.getAvroSchemaNodeByFullPath(fullpath, nonPrimitiveAndNonNullSchemas[0], nextIndex);
            } else {
              return nextFieldType;
            }
          } else {
            return AvroUtil.getAvroSchemaNodeByFullPath(fullpath, nextFieldType, nextIndex);
          }
        } else if (matchedFields.length === 0) {
          return null;
        } else {
          throw new AvroException('Multiple fields have the same fullpath, unknown which one should be returned');
        }
      } else if (schema instanceof ArraySchema) {
        return AvroUtil.getAvroSchemaNodeByFullPath(fullpath, schema.items, nextIndex);
      }
    }

    return null;
  }

  static getOtherProperties(allProperties, reservedProperties) {
    return Object.keys(allProperties)
      .filter(k => !reservedProperties.includes(k))
      .reduce((obj, key) => {
        obj[key] = allProperties[key];
        return obj;
      }, {});
  }

  static makeAvscObject(jsonData, names = null) {
    if (names === null) {
      names = new Names();
    }

    if (!Util.isNullOrUndefined(jsonData['type'])) {
      let type = jsonData['type'];
      let otherProperties = AvroUtil.getOtherProperties(jsonData, SCHEMA_RESERVED_PROPS);

      if (PRIMITIVE_TYPES.includes(type)) {
        return new PrimitiveSchema(type, otherProperties);
      } else if (NAMED_TYPES.includes(type)) {
        let name = jsonData['name'];
        let namespace = jsonData['namespace'] ? jsonData['namespace'] : names.defaultNamespace;

        if (type === 'fixed') {
          let size = jsonData['size'];
          return new FixedSchema(name, size, namespace, names, otherProperties);
        } else if (type === 'enum') {
          let symbols = jsonData['symbols'];
          let doc = jsonData['doc'];
          return new EnumSchema(name, namespace, symbols, names, doc, otherProperties);
        } else if (type === 'record' || type === 'error') {
          let fields = jsonData['fields'];
          let doc = jsonData['doc'];
          return new RecordSchema(name, namespace, fields, names, type, doc, otherProperties);
        } else {
          throw new SchemaParseException(`Unknown Named Type: ${type}`);
        }
      } else if (VALID_TYPES.includes(type)) {
        if (type === 'array') {
          let items = jsonData['items'];
          return new ArraySchema(items, names, otherProperties);
        } else if (type === 'map') {
          let values = jsonData['values'];
          return new MapSchema(values, names, otherProperties);
        } else if (type === 'error_union') {
          let declaredErrors = jsonData['declared_errors'];
          return new ErrorUnionSchema(declaredErrors, names);
        } else {
          throw new SchemaParseException(`Unknown Valid Type: ${type}`);
        }
      } else {
        throw new SchemaParseException(`Undefined type: ${type}`);
      }

    } else if (Array.isArray(jsonData)) {
      return new UnionSchema(jsonData, names);
    } else if (PRIMITIVE_TYPES.includes(jsonData)) {
      return new PrimitiveSchema(jsonData, null);
    } else {
      throw new SchemaParseException(`Could not make an Avro Schema object from ${jsonData}`);
    }
  }
}

const PRIMITIVE_TYPES = ['null', 'boolean', 'string', 'bytes', 'int', 'long', 'float', 'double'];
const NAMED_TYPES = ['fixed', 'enum', 'record', 'error'];
const VALID_TYPES = ['array', 'map', 'union', 'request', 'error_union'].concat(PRIMITIVE_TYPES, NAMED_TYPES);

const SCHEMA_RESERVED_PROPS = [
  'type',
  'name',
  'namespace',
  'fields',     // Record
  'items',      // Array
  'size',       // Fixed
  'symbols',    // Enum
  'values',     // Map
  'doc'
];

const FIELD_RESERVED_PROPS = [
  'default',
  'name',
  'doc',
  'order',
  'type'
];

/* Exceptions */
class AvroException extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AvroException.prototype);
  }
}

class SchemaParseException extends AvroException {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, SchemaParseException.prototype);
  }
}

/* Types */
export type SchemaType =
  AvroSchema
  | NamedSchema
  | PrimitiveSchema
  | FixedSchema
  | EnumSchema
  | ArraySchema
  | MapSchema
  | UnionSchema
  | ErrorUnionSchema
  | RecordSchema
  | Field;

/* Base classes */
export class AvroSchema {
  name: string;
  type: any;
  fullpath: string;
  properties = {};
  otherProperties = {};

  constructor(type, otherProperties = null) {
    if (!VALID_TYPES.includes(type)) {
      throw new SchemaParseException(`${type} is not a valid type`);
    }

    this.properties['type'] = type;
    this.type = type;
    this.otherProperties = otherProperties ? otherProperties : {};
  }

  static assignFullpaths(schema: AvroSchema, traversalPath: string = '') {
    if (schema instanceof Field) {
      traversalPath = `${traversalPath}.${schema.name}`;
      schema.fullpath = traversalPath;
      AvroSchema.assignFullpaths(schema.type, traversalPath);
    } else if (schema instanceof RecordSchema) {
      traversalPath = traversalPath.length === 0 ? schema.name : traversalPath;
      schema.fullpath = traversalPath;

      if (schema.fields) {
        schema.fields.forEach((field: Field) => {
          AvroSchema.assignFullpaths(field, traversalPath);
        });
      }
    } else if (schema instanceof ArraySchema) {
      schema.fullpath = traversalPath;
      let nextTraversalPath = `${traversalPath}.${schema.items.name}`;
      AvroSchema.assignFullpaths(schema.items, nextTraversalPath);
    } else if (schema instanceof MapSchema) {
      schema.fullpath = traversalPath;
      let nextTraversalPath = `${traversalPath}.${schema.values.name}`;
      AvroSchema.assignFullpaths(schema.values, nextTraversalPath);
    } else if (schema instanceof UnionSchema || schema instanceof ErrorUnionSchema) {
      schema.fullpath = traversalPath;

      let nonPrimitiveSchemasCount = AvroUtil.getNonPrimitiveSchemas(schema.schemas).length;

      schema.schemas.forEach(s => {
        // Ensure a unique but simplified name (by not including the record name) when the schema is a record
        // and when there's only one record in the union
        if (s instanceof RecordSchema && nonPrimitiveSchemasCount > 1) {
          AvroSchema.assignFullpaths(s, `${traversalPath}.${s.name}`)
        } else {
          AvroSchema.assignFullpaths(s, traversalPath)
        }
      });
    } else if (schema instanceof PrimitiveSchema
      || schema instanceof EnumSchema
      || schema instanceof FixedSchema) {
      schema.fullpath = schema.name ? `${traversalPath}.${schema.name}` : traversalPath;
    }
  }
}

class Names {
  names = {};
  defaultNamespace;

  constructor(defaultNamespace = null) {
    this.defaultNamespace = defaultNamespace;
  }

  hasName(nameAttr, spaceAttr) {
    let test = new Name(nameAttr, spaceAttr, this.defaultNamespace).fullname;
    return test in this.names;
  }

  getName(nameAttr, spaceAttr) {
    let test = new Name(nameAttr, spaceAttr, this.defaultNamespace).fullname;
    if (!(test in this.names)) {
      return null;
    }
    return Util.copyString(this.names[test]);
  }

  addName(nameAttr, spaceAttr, newSchema): Name {
    let toAdd = new Name(nameAttr, spaceAttr, this.defaultNamespace);

    if (VALID_TYPES.includes(toAdd.fullname)) {
      throw new SchemaParseException(`${toAdd.fullname} is a reserved type name.`);
    } else if (toAdd.fullname in this.names) {
      throw new SchemaParseException(`The name ${toAdd.fullname} is already in use`);
    }

    this.names[toAdd.fullname] = newSchema;
    return toAdd;
  }
}

class Name {
  fullname: string;

  constructor(nameAttr: string, spaceAttr: string, defaultSpace: string) {
    if (Util.isNullOrUndefined(nameAttr) || nameAttr === '') {
      return;
    }

    if (nameAttr.indexOf('.') < 0) {
      if (!Util.isNullOrUndefined(spaceAttr) && spaceAttr !== '') {
        this.fullname = `${spaceAttr}.${nameAttr}`;
      } else {
        if (!Util.isNullOrUndefined(defaultSpace) && defaultSpace !== '') {
          this.fullname = `${defaultSpace}.${nameAttr}`;
        } else {
          this.fullname = nameAttr;
        }
      }
    } else {
      this.fullname = nameAttr;
    }
  }

  getSpace() {
    if (Util.isNullOrUndefined(this.fullname)) {
      return null;
    }

    if (this.fullname.indexOf('.') > 0) {
      let fullnameSplitted = this.fullname.split('.');

      return fullnameSplitted.slice(0, fullnameSplitted.length - 1).join('.');
    } else {
      return '';
    }
  }
}

export class NamedSchema extends AvroSchema {
  name: string;
  namespace: string;
  fullname: string;

  constructor(type, name = null, namespace = null, names: Names = null, otherProperties: any = null) {
    super(type, otherProperties);

    if (!Util.isNullOrUndefined(name)) {
      let newName = names.addName(name, namespace, this);

      this.properties['name'] = name;

      if (!Util.isNullOrUndefined(namespace)) {
        this.properties['namespace'] = newName.getSpace();
      }

      this.fullname = newName.fullname;
      this.name = name;
    }
  }
}

export class Field {
  defaultValue?: any;
  hasDefault: boolean;
  order?: any;
  doc?: string;
  properties = {};
  otherProperties: object;
  type: any;
  name: string;
  fullpath: string;

  constructor(type, name: string, hasDefault, defaultValue = null, order = null, names: Names = null, doc = null, otherProperties = null) {
    this.hasDefault = hasDefault;
    Object.assign(this.properties, otherProperties);

    let typeSchema;

    if (typeof type === 'string' && !Util.isNullOrUndefined(names) && names.hasName(type, null)) {
      typeSchema = names.getName(type, null);
    } else {
      try {
        typeSchema = AvroUtil.makeAvscObject(type, names);
      } catch(e) {
        throw new SchemaParseException(`Type property "${type}" is not a valid Avro schema: ${e}`);
      }
    }

    this.properties['type'] = typeSchema;
    this.properties['name'] = name;
    this.type = typeSchema;
    this.name = name;

    if (this.hasDefault) {
      this.properties['defaultValue'] = defaultValue;
      this.defaultValue = defaultValue;
    }
    if (!Util.isNullOrUndefined(order)) {
      this.properties['order'] = order;
      this.order = order;
    }
    if (!Util.isNullOrUndefined(doc)) {
      this.properties['doc'] = doc;
      this.doc = doc;
    }

    this.otherProperties = AvroUtil.getOtherProperties(this.properties, FIELD_RESERVED_PROPS);
  }
}

export class PrimitiveSchema extends AvroSchema {
  fullname: string;

  constructor(type, otherProperties = null) {
    if (!PRIMITIVE_TYPES.includes(type)) {
      throw new AvroException(`${type} is not a valid primitive type`);
    }

    super(type, otherProperties);

    this.fullname = type;
  }
}

export class FixedSchema extends NamedSchema {
  size: number;

  constructor(name, size, namespace: any, names: Names, otherProperties: any) {
    if (typeof size !== 'number') {
      throw new AvroException('Fixed AvroSchema requires a valid integer for size property.');
    }

    super('fixed', name, namespace, names, otherProperties);

    this.properties['size'] = size;
    this.size = size;
  }
}

export class EnumSchema extends NamedSchema {
  symbols: string[];
  doc: string;

  constructor(name, namespace: any, symbols: string[], names: Names = null, doc: string = null, otherProperties: any = null) {
    super('enum', name, namespace, names, otherProperties);

    this.properties['symbols'] = symbols;
    this.symbols = symbols;

    if (!Util.isNullOrUndefined(doc)) {
      this.properties['doc'] = doc;
      this.doc = doc;
    }
  }
}

/* Complex types */

export class ArraySchema extends AvroSchema {
  items: AvroSchema;

  constructor(items, names: Names = null, otherProperties: any = null) {
    super('array', otherProperties);


    let itemsSchema;

    if (typeof items === 'string' && names.hasName(items, null)) {
      itemsSchema = names.getName(items, null);
    } else {
      try {
        itemsSchema = AvroUtil.makeAvscObject(items, names);
      } catch(e) {
        throw new SchemaParseException(`Items schema (${items}) not a valid Avro schema: ${e} (known names: ${Object.keys(names.names)})`)
      }
    }

    this.properties['items'] = itemsSchema;
    this.items = itemsSchema;
  }
}

export class MapSchema extends AvroSchema {
  values: any;

  constructor(values, names: Names = null, otherProperties: any = null) {
    super('map', otherProperties);

    let valuesSchema;

    if (typeof values === 'string' && names.hasName(values, null)) {
      valuesSchema = names.getName(values, null);
    } else {
      try {
        valuesSchema = AvroUtil.makeAvscObject(values, names);
      } catch(e) {
        throw new SchemaParseException(`Values schema not a valid Avro schema.`)
      }
    }

    this.properties['values'] = valuesSchema;
    this.values = valuesSchema;
  }
}

export class UnionSchema extends AvroSchema {
  schemas: AvroSchema[];

  constructor(schemas, names: Names = null) {
    if (!Array.isArray(schemas)) {
      throw new SchemaParseException('Union schema requires a list of schemas.');
    }

    super('union', null);

    let schemaObjects = [];

    schemas.forEach(schema => {
      let newSchema;

      if (typeof schema === 'string' && names.hasName(schema, null)) {
        newSchema = names.getName(schema, null);
      } else {
        try {
          newSchema = AvroUtil.makeAvscObject(schema, names);
        } catch(e) {
          throw new SchemaParseException(`Union item must be a valid Avro schema: ${e}`);
        }
      }

      if (VALID_TYPES.includes(newSchema.type) && !NAMED_TYPES.includes(newSchema.type)
        && schemaObjects.map(s => s.type).includes(newSchema.type)) {
        throw new SchemaParseException(`${newSchema.type} type already in Union`)
      } else if (newSchema.type === 'union') {
        throw new SchemaParseException('Unions cannot contain other unions.');
      } else {
        schemaObjects.push(newSchema);
      }
    });

    this.schemas = schemaObjects;
  }
}

export class ErrorUnionSchema extends UnionSchema {
  constructor(schemas, names: Names) {
    super(schemas.concat(['string']), names);
  }
}

export class RecordSchema extends NamedSchema {
  fields: any[];
  doc: string;

  constructor(name: string, namespace: any, fields: any[], names: Names, schemaType: string = 'record', doc: string = null, otherProperties: any = null) {
    if (schemaType === 'request') {
      super(schemaType, null, null, null, otherProperties);
    } else {
      super(schemaType, name, namespace, names, otherProperties);
    }

    let oldDefault;

    if (schemaType === 'record') {
      oldDefault = names.defaultNamespace;
      names.defaultNamespace = new Name(name, namespace, names.defaultNamespace).getSpace()
    }


    let fieldObjects = RecordSchema.makeFieldObjects(fields, names);
    this.properties['fields'] = fieldObjects;
    this.fields = fieldObjects;
    this.name = name;

    if (!Util.isNullOrUndefined(doc)) {
      this.properties['doc'] = doc;
      this.doc = doc;
    }

    if (schemaType === 'record') {
      names.defaultNamespace = oldDefault;
    }
  }

  static makeFieldObjects(fieldData, names: Names): any[] {
    let fieldObjects = [];
    let fieldNames = [];

    fieldData.forEach(field => {
      let newField;

      if (Util.isObject(field)) {
        const type = field['type'];
        const name = field['name'];

        let hasDefault = Object.keys(field).includes('default');
        let defaultValue = undefined;

        if (hasDefault && Util.isNullOrUndefined(field['default'])) {
          // Default value of 'null'
          defaultValue = 'null';
        } else if (hasDefault && Array.isArray(field['default'])) {
          // Default value of 'for arrays'
          defaultValue = '[ ] - empty array';
        } else if (hasDefault && Util.isObject(field['default'])) {
          defaultValue = '{ } - empty map';
        } else {
          defaultValue = field['default'];
        }

        let order = field['order'];
        let doc = field['doc'];

        let otherProperties = AvroUtil.getOtherProperties(field, FIELD_RESERVED_PROPS);
        newField = new Field(type, name, hasDefault, defaultValue, order, names, doc, otherProperties);

        if (fieldNames.includes(newField.name)) {
          throw new SchemaParseException(`Field name ${newField.name} already in use.`);
        }

        fieldNames.push(newField.name);
      } else {
        throw new SchemaParseException(`Not a valid field: ${field}`);
      }
      fieldObjects.push(newField);
    });

    return fieldObjects;
  }
}
