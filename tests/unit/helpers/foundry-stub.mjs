/**
 * Import this FIRST in a unit test whose subject touches Foundry globals only at import time
 * (e.g. `data/fields.mjs` extends `foundry.data.fields.NumberField`). It defines just enough for the import to work;
 * the tests never call into the stubs.
 */
class StubField {
  constructor(options = {}) {
    this.options = options;
  }
}

globalThis.foundry ??= {};
globalThis.foundry.data ??= {
  fields: {
    NumberField: class NumberField extends StubField {},
    SchemaField: class SchemaField extends StubField {},
    StringField: class StringField extends StubField {},
    ArrayField: class ArrayField extends StubField {}
  }
};
globalThis.Actor ??= class Actor {};
globalThis.Item ??= class Item {};
