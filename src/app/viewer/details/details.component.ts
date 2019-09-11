import {Component, Input} from '@angular/core';
import {
  ArraySchema,
  AvroSchema,
  AvroUtil,
  EnumSchema,
  ErrorUnionSchema,
  Field,
  FixedSchema,
  MapSchema,
  PrimitiveSchema,
  RecordSchema,
  SchemaType,
  UnionSchema
} from '../../models/avro-schema.model';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent {
  name: string;
  schemaType: string;
  symbols: string[];
  isNullable: boolean = false;

  private _selectedSchema: SchemaType;

  constructor() {
  }

  get selectedSchema() {
    return this._selectedSchema;
  }

  @Input()
  set selectedSchema(selectedSchema: SchemaType) {
    this.resetFields();

    if (selectedSchema !== undefined) {
      this._selectedSchema = selectedSchema;
      this.name = selectedSchema.name;
      this.schemaType = this.getSchemaTypeName(selectedSchema);
    }
  }

  private resetFields() {
    this.name = null;
    this.schemaType = null;
    this.symbols = null;
    this.isNullable = false;
  }

  private getSchemaTypeName(schema: AvroSchema) {
    if (schema instanceof Field) {
      return this.getSchemaTypeName(schema.type);
    } else if (schema instanceof PrimitiveSchema) {
      return `Primitive (${this.getUnion(schema)})`;
    } else if (schema instanceof ArraySchema) {
      return `Array (${this.getUnion(schema)})`;
    } else if (schema instanceof MapSchema) {
      return `Map (${this.getUnion(schema)})`;
    } else if (schema instanceof RecordSchema) {
      return `Record (${this.getUnion(schema)})`;
    } else if (schema instanceof FixedSchema) {
      return `Fixed (${this.getUnion(schema)} - size: ${schema.size})`;
    } else if (schema instanceof EnumSchema) {
      this.symbols = schema.symbols;
      return 'Enum';
    } else if (schema instanceof UnionSchema) {
      this.isNullable = AvroUtil.isNullable(schema.schemas);
      return `Union { ${schema.schemas.map(schema => this.getUnion(schema)).join(', ')} }`;
    } else if (schema instanceof ErrorUnionSchema) {
      this.isNullable = AvroUtil.isNullable(schema.schemas);
      return `Error Union { ${schema.schemas.map(schema => this.getUnion(schema)).join(', ')} }`;
    }
  }

  private getUnion(schema: AvroSchema) {
    if (schema instanceof PrimitiveSchema) {
      return schema.type;
    } else if (schema instanceof FixedSchema) {
      return `${schema.type} (${schema.size})`;
    } else if (schema instanceof ArraySchema) {
      return `${this.getUnion(schema.items)} [ ]`;
    } else if (schema instanceof MapSchema) {
      return `${this.getUnion(schema.values)} { }`;
    } else {
      return schema.name;
    }
  }
}
