// Lua object handles and operations. C nhlobj.c.
import { objectClassForType, objectBaseWeight, objectBaseCost, objectDelay, objectPropertyId, objectDirection, objectBimanual, objectMerge, objectUsesKnown, objectUnique, objectMagic, objectCharged, ARROW, CORPSE, EGG, FIGURINE, STATUE, TIN, OBJECT_COLOR, OBJECT_DESCRIPTIONS, OBJECT_INITIAL_KNOWN, OBJECT_LARGE_DAMAGE, OBJECT_MATERIAL_NAMES, OBJECT_NAMES, OBJECT_NOWISH, OBJECT_NUTRITION, OBJECT_PROB, OBJECT_SMALL_DAMAGE, OBJECT_TOUGH, } from '../object_data.js';
import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE, OBJECT_TIMER_KIND } from '../const.js';
import { isok } from '../cmd.js';
import { buryObject } from '../dig.js';
import { newsym } from '../display.js';
import { game } from '../gstate.js';
import { removeHeroEquipment } from '../hero_equipment.js';
import { finishInventoryRemoval } from '../invent.js';
import { cleanupObjectBurn } from '../timeout.js';
import { mkobj, mksobj, addObjectToContainer, unlinkObject } from '../mkobj.js';
import { MONSTER_NAME } from '../monster_data.js';
import { OBJECT_CLASS_SYMBOLS } from '../display.js';
import { objectMaterial } from '../o_init.js';
import { isPoisonableObject } from '../object_properties.js';
import { readObjectName } from '../objnam.js';
import { addInventoryItem } from '../invent.js';
import { objectTypeForName } from './des.js';
import { luaInteger } from './arguments.js';
import { LuaTable, LuaUserdata, luaTableToObject, objectToLuaTable } from './runtime.js';
import { deleteObject } from '../shk.js';
import { objectTimers, scheduleObjectTimer, stopAllObjectTimers, stopObjectTimer } from '../timeout.js';
import { objectWeight, isContainer, placeObject } from '../mkobj.js';
class ObjectHandle extends LuaUserdata {
}
const LOCATIONS = {
    free: 0, floor: 1, contained: 2, inventory: 3, minvent: 4,
    migrating: 5, buried: 6, onbill: 7, gone: 8,
};
const OBJECT_FIELDS = [
    'o_id', 'ox', 'oy', 'otyp', 'owt', 'quan', 'spe', 'cursed', 'blessed',
    'unpaid', 'no_charge', 'known', 'dknown', 'bknown', 'rknown', 'tknown',
    'oeroded2', 'oerodeproof', 'olocked', 'obroken', 'recharged', 'lamplit',
    'globby', 'greased', 'nomerge', 'how_lost', 'in_use', 'bypass', 'cknown',
    'lknown', 'oeaten', 'age', 'owornmask',
];
const TIMER_KINDS = new Map([
    ['rot-organic', OBJECT_TIMER_KIND.ROT_ORGANIC], ['rot-corpse', OBJECT_TIMER_KIND.ROT_CORPSE],
    ['revive-mon', OBJECT_TIMER_KIND.REVIVE_MON], ['zombify-mon', OBJECT_TIMER_KIND.ZOMBIFY_MON],
    ['burn-obj', OBJECT_TIMER_KIND.BURN_OBJECT], ['hatch-egg', OBJECT_TIMER_KIND.HATCH_EGG],
    ['fig-transform', OBJECT_TIMER_KIND.FIG_TRANSFORM], ['shrink-glob', OBJECT_TIMER_KIND.SHRINK_GLOB],
    ['melt-ice', null],
]);
// C nhlobj.c checks lua_gettop() only for new, at, class, placeobj, the
// timer methods, and bury.  The other methods never look at argc, so extra
// arguments are ignored, and next() consults its flag only at exactly two
// arguments.  l_obj_bury accepts exactly one or three arguments; a range
// would wrongly admit the two-argument form.
const ARGUMENT_COUNTS = {
    new: { min: 1, max: 1 }, isnull: { min: 1 }, at: { min: 2, max: 2 },
    next: { min: 0 }, totable: { min: 1 }, class: { min: 1, max: 1 },
    contents: { min: 1 }, container: { min: 1 }, addcontent: { min: 2 },
    placeobj: { min: 3, max: 3 },
    has_timer: { min: 2, max: 2 }, peek_timer: { min: 2, max: 2 },
    stop_timer: { min: 1, max: 2 }, start_timer: { min: 3, max: 3 },
    bury: { oneOf: [1, 3] },
};
// C nhlobj.c:l_obj_check(): the obj userdata, or an error.
function handle(value) {
    if (!(value instanceof ObjectHandle))
        throw new TypeError('object operation requires a Lua object');
    return value;
}
function object(value) {
    const item = handle(value).value;
    return item && item.where !== 'gone' ? item : null;
}
function timerKind(name) {
    if (typeof name !== 'string' || !TIMER_KINDS.has(name))
        throw new TypeError(`Unknown object timer: ${name}`);
    return TIMER_KINDS.get(name) ?? null;
}
// C nhlobj.c:l_obj_timer_stop(): stop every timer of the object, or only
// the named kind, running burn cleanup for what stopped.
function stopTimers(item, kind, state) {
    if (!item)
        return [];
    const stopped = kind === undefined ? stopAllObjectTimers(item)
        : [stopObjectTimer(item, kind)].filter(timer => timer != null);
    for (const timer of stopped) {
        if (timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT)
            cleanupObjectBurn(item, timer.deadline, state);
    }
    return stopped;
}
// C nhlobj.c:l_obj_register(): the obj method table and metatable. Entries
// without a helper of their own below: at (l_obj_at()), next
// (l_obj_nextobj(), walking floorChain()/objectChain()), contents
// (l_obj_getcontents()), container (l_obj_container()), isnull
// (l_obj_isnull()), and the timer methods (l_obj_timer_has(),
// l_obj_timer_peek(), l_obj_timer_start()); l_obj_push() is the wrap
// method, and l_obj_gc() is the FinalizationRegistry plus destroy(), which
// free only objects still outside the game.
export function createObjectApi(state = game) {
    const created = new Set();
    const collected = new FinalizationRegistry(reference => {
        created.delete(reference);
        state._luaObjectRefs?.delete(reference);
    });
    const api = {
        bindings: new LuaTable(),
        toAbsolute: (x, y) => ({ x, y }),
        wrap: item => new ObjectHandle(item, metatable),
        async destroy() {
            for (const reference of created) {
                collected.unregister(reference);
                state._luaObjectRefs?.delete(reference);
                const item = reference.deref();
                if (item?.where === 'free')
                    await deleteObject(item, state);
            }
            created.clear();
        },
        async give(itemHandle) {
            const item = object(itemHandle);
            if (!item || item.where === 'inventory')
                return;
            await detach(item);
            handle(itemHandle).value = await addInventoryItem(item);
        },
        async clearInventory() {
            for (const item of [...state.inventory]) {
                await removeHeroEquipment(item, state);
                await detach(item);
                await deleteObject(item, state);
            }
        },
    };
    async function detach(item) {
        const carried = item.where === 'inventory';
        unlinkObject(item, state);
        if (carried)
            await finishInventoryRemoval(item, state);
    }
    // C nhlobj.c:l_obj_new_readobjnam(): a wished-for object by name, or a
    // table's id or class; readobjnam() or mkobj()/mksobj() builds it.
    async function create(value) {
        let item;
        if (typeof value === 'string') {
            const result = await readObjectName(value, { wizardWish: !!state.flags?.debug });
            item = result && !result.noWish ? result.object : null;
        }
        else if (value instanceof LuaTable) {
            const options = luaTableToObject(value);
            const type = options.id == null ? 0
                : objectTypeForName(options.id, options.class, state);
            const oclass = typeof options.class === 'string'
                ? OBJECT_CLASS_SYMBOLS.indexOf(options.class) : -1;
            // ARROW is FIRST_OBJECT; earlier entries represent class glyphs.
            item = type < ARROW ? await mkobj(Math.max(0, oclass), false)
                : await mksobj(type, true, false);
        }
        else
            throw new TypeError('obj.new expects an object name or table');
        if (item) {
            // Weak references let abandoned Lua temporaries be collected.
            // Closing the Lua state frees only items still outside the game.
            const reference = new WeakRef(item);
            created.add(reference);
            (state._luaObjectRefs ||= new Set()).add(reference);
            collected.register(item, reference, reference);
        }
        return api.wrap(item);
    }
    const methods = {
        new: create,
        isnull: value => object(value) === null,
        at: (x, y) => {
            const point = api.toAbsolute(luaInteger(x), luaInteger(y));
            return api.wrap(state.level?.objects?.[point.x]?.[point.y]?.[0] || null);
        },
        next: (...args) => {
            const [value, flag] = args;
            if (value === undefined)
                return api.wrap(floorChain(state)[0] || null);
            const item = object(value);
            if (!item)
                return api.wrap(null);
            // l_obj_nextobj() reads its flag argument only at exactly two
            // arguments; with three or more it falls back to the nobj chain.
            const onSquare = args.length === 2 && flag != null && flag !== false;
            const chain = objectChain(item, onSquare, state);
            return api.wrap(chain[chain.indexOf(item) + 1] || null);
        },
        totable: value => objectTable(object(value), state),
        class: value => classTable(typeof value === 'number' ? value : handle(value).value?.otyp, state),
        contents: value => {
            const item = object(value);
            if (!item)
                throw new TypeError('cannot read contents of a null object');
            return api.wrap(item.contents?.[0] || null);
        },
        container: value => {
            const item = object(value);
            return api.wrap(item?.where === 'contained' ? item.container ?? null : null);
        },
        // C nhlobj.c:l_obj_add_to_container(): extract the object, add it
        // to the container, and reweigh the container.
        async addcontent(boxHandle, itemHandle) {
            const box = object(boxHandle), item = object(itemHandle);
            if (!box || !item)
                return;
            await detach(item);
            handle(itemHandle).value = await addObjectToContainer(box, item, state);
            box.owt = objectWeight(box);
        },
        // C nhlobj.c:l_obj_placeobj(): extract, place on the map, redraw.
        async placeobj(value, x, y) {
            const item = object(value);
            const point = api.toAbsolute(luaInteger(x), luaInteger(y));
            if (!item)
                return;
            await detach(item);
            await placeObject(item, point.x, point.y, state);
            await newsym(point.x, point.y);
        },
        has_timer: (value, name) => {
            const kind = timerKind(name);
            return objectTimers(object(value)).some(timer => timer.kind === kind);
        },
        peek_timer: (value, name) => {
            const kind = timerKind(name);
            return objectTimers(object(value)).find(timer => timer.kind === kind)?.deadline || 0;
        },
        stop_timer: (value, name) => {
            const item = object(value);
            if (name === undefined) {
                stopTimers(item, undefined, state);
                return;
            }
            const [timer] = stopTimers(item, timerKind(name), state);
            return timer ? timer.deadline - state.moves : 0;
        },
        start_timer: (value, name, timeout) => {
            const kind = timerKind(name), when = luaInteger(timeout);
            const item = object(value);
            if (item && kind && when > 0) {
                stopTimers(item, kind, state);
                scheduleObjectTimer(item, kind, state.moves + when, state);
            }
        },
        // C nhlobj.c:l_obj_bury(): bury at the object's square or a given
        // one; true when the ground absorbed the object.
        async bury(value, x, y) {
            const item = object(value);
            if (!item)
                return false;
            const point = x === undefined ? { x: item.ox, y: item.oy }
                : api.toAbsolute(luaInteger(x), luaInteger(y));
            if (!isok(point.x, point.y))
                return false;
            item.ox = point.x;
            item.oy = point.y;
            const result = await buryObject(item, state);
            return result.outcome === 'absorbed';
        },
    };
    for (const [name, spec] of Object.entries(ARGUMENT_COUNTS)) {
        const operation = methods[name];
        if (!operation)
            throw new Error(`Missing Lua object operation: ${name}`);
        methods[name] = (...args) => {
            if ('oneOf' in spec) {
                if (!spec.oneOf.includes(args.length))
                    throw new TypeError(`obj.${name} expects ${spec.oneOf.join(' or ')} arguments, got ${args.length}`);
            }
            else if (args.length < spec.min
                || (spec.max !== undefined && args.length > spec.max)) {
                throw new TypeError(`obj.${name} expects ${spec.max === undefined
                    ? `at least ${spec.min}` : spec.min === spec.max ? `${spec.min}` : `${spec.min} to ${spec.max}`} arguments, got ${args.length}`);
            }
            return operation(...args);
        };
    }
    api.bindings = objectToLuaTable(methods);
    const metatable = { __name: 'obj', __index: api.bindings };
    return api;
}
function floorChain(state) {
    return (state.level?.objects || []).flatMap(column => (column || []).flatMap(pile => pile || []))
        .sort((a, b) => (b._fobjOrder || 0) - (a._fobjOrder || 0));
}
// C nhlobj.c:l_obj_nextobj(): the chain a next() step walks — the floor
// pile (nexthere) or the object list (nobj) for every object location.
function objectChain(item, onSquare, state) {
    switch (item.where) {
        case 'floor': {
            if (!onSquare)
                return floorChain(state);
            if (!state.level)
                throw new Error('A floor object requires an active level');
            return state.level.objects[item.ox]?.[item.oy] ?? [];
        }
        case 'contained': return item.container?.contents || [];
        case 'inventory': return state.inventory;
        case 'minvent': {
            if (!state.level)
                throw new Error('A monster inventory requires an active level');
            return state.level.monsters.find(monster => monster.m_id === item.carrierMid)?.minvent || [];
        }
        case 'buried': {
            if (!state.level)
                throw new Error('A buried object requires an active level');
            return state.level.buriedObjects ?? [];
        }
        case 'migrating': return state.migratingObjects ?? [];
        case 'onbill': return state.billObjects ?? [];
        case 'free':
        case 'gone': return [];
    }
}
// C nhlobj.c:l_obj_to_table(): every object field as a Lua table, NO_OBJ
// for a null object.
function objectTable(item, state) {
    if (!item)
        return objectToLuaTable({ NO_OBJ: 1 });
    const values = Object.fromEntries(OBJECT_FIELDS.map(field => [field, Number(item[field] || 0)]));
    // C obj.h overloads usecount as spestudied (spellbook study tally) and
    // wishedfor (1 while a wished object is held); JS keeps both as their own
    // fields, so report their sum like the shared field would hold.
    values.usecount = (item.spestudied ?? 0) + (item.wishedfor ? 1 : 0);
    values.has_contents = Number(!!item.contents?.length);
    values.is_container = Number(isContainer(item));
    values.otyp_name = OBJECT_NAMES[item.otyp];
    values.otyp_descr = state.objectDescriptions?.[item.otyp] ?? OBJECT_DESCRIPTIONS[item.otyp];
    values.oclass = OBJECT_CLASS_SYMBOLS[item.oclass];
    values.invlet = item.invlet || '';
    values.where = LOCATIONS[item.where];
    values.corpsenm = item.corpsenm ?? -1;
    if (item.otyp === STATUE)
        values.historic = Number(!!(item.spe & CORPSTAT_HISTORIC));
    if (item.otyp === CORPSE || item.otyp === STATUE) {
        values.male = Number(!!(item.spe & CORPSTAT_MALE));
        values.female = Number(!!(item.spe & CORPSTAT_FEMALE));
    }
    if (item.oclass === 8)
        values.odiluted = Number(!!(item.odiluted || item.diluted));
    else
        values.oeroded = item.oeroded || 0;
    if (isPoisonableObject(item))
        values.opoisoned = Number(!!item.opoisoned);
    else
        values.otrapped = Number(!!item.otrapped);
    if ([TIN, CORPSE, EGG, FIGURINE, STATUE].includes(item.otyp) && item.corpsenm != null && item.corpsenm >= 0)
        values.corpsenm_name = MONSTER_NAME[item.corpsenm];
    const name = item.oextra?.oname || item.oname;
    values.has_oname = Number(!!name);
    if (name)
        values.oname = name;
    return objectToLuaTable(values);
}
// C nhlobj.c:l_obj_objects_to_table(): the class data of an object type or
// a carried object.
function classTable(type, state) {
    if (typeof type !== 'number' || !Number.isInteger(type) || type < 0 || type >= OBJECT_NAMES.length)
        throw new TypeError('obj.class requires an object or object type');
    const material = objectMaterial(type, state);
    return objectToLuaTable({
        name: OBJECT_NAMES[type],
        descr: state.objectDescriptions?.[type] ?? OBJECT_DESCRIPTIONS[type],
        uname: state._objectCallNames?.[type],
        name_known: Number(!!OBJECT_INITIAL_KNOWN[type] || !!state._knownObjectTypes?.has(type)),
        encountered: Number(!!state._encounteredObjectTypes?.has(type)),
        merge: objectMerge(type), uses_known: objectUsesKnown(type),
        magic: objectMagic(type), charged: objectCharged(type),
        unique: objectUnique(type), nowish: OBJECT_NOWISH[type],
        big: objectBimanual(type), tough: state.objectToughness?.[type] ?? OBJECT_TOUGH[type],
        dir: objectDirection(type, state),
        material: OBJECT_MATERIAL_NAMES[material],
        oprop: objectPropertyId(type), class: OBJECT_CLASS_SYMBOLS[objectClassForType(type)],
        delay: objectDelay(type), color: state.objectColors?.[type] ?? OBJECT_COLOR[type],
        prob: OBJECT_PROB[type], weight: objectBaseWeight(type), cost: objectBaseCost(type),
        damage_small: OBJECT_SMALL_DAMAGE[type], damage_large: OBJECT_LARGE_DAMAGE[type],
        nutrition: OBJECT_NUTRITION[type],
    });
}
//# sourceMappingURL=objects.js.map