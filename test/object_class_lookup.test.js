import { objectClassForType, getObjectDefinition, OBJECT_NAMES, } from '../js/object_data.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { objectTypeForName } from '../js/lua/des.js';
// C sp_lev.c:find_objtype(): the class filter includes objects.h's GENERIC
// entries, whose class matches the slot even though they are not real items.
void test('Lua resolves generic object names within their native class', () => {
    assert.equal(objectTypeForName('generic potion', '!'), 8);
    assert.equal(objectTypeForName('generic spellbook', '+'), 10);
    assert.equal(objectTypeForName('generic venom', '.'), 17);
});
void test('the strange object has the illegal-object class rather than the random-class sentinel', () => {
    assert.equal(objectClassForType(0), 1);
    assert.equal(getObjectDefinition(0).oclass, 1);
    assert.equal(objectTypeForName('strange object', ']'), 0);
});
void test('a missing or invalid object type has no class', () => {
    for (const type of [null, undefined, -1, OBJECT_NAMES.length, 2 ** 32, 1.5, NaN, Infinity, -Infinity]) {
        assert.equal(objectClassForType(type), 0, `type ${type}`);
    }
});
//# sourceMappingURL=object_class_lookup.test.js.map