// Lua object handles and operations. C nhlobj.c.

import { isok, CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE } from '../const.js';
import { canBuryObject, buryUnlinkedObject } from '../buried_object.js';
import { isContainer } from '../container.js';
import { newsym } from '../display.js';
import { place_object } from '../floor_object.js';
import { game } from '../gstate.js';
import { removeHeroEquipment } from '../hero_equipment.js';
import { finishInventoryRemoval } from '../hero_inventory.js';
import { cleanupObjectBurn } from '../light.js';
import { mkobj, mksobj } from '../mklev.js';
import { MONSTER_NAME } from '../monster_data.js';
import { addObjectToContainer } from '../object_container.js';
import { deleteObject } from '../object_delete.js';
import { unlinkObject } from '../object_location.js';
import {
    ARROW, CORPSE, EGG, FIGURINE, STATUE, TIN,
    OBJECT_BIMANUAL, OBJECT_CHARGED, OBJECT_COLOR, OBJECT_COST, OBJECT_DELAY,
    OBJECT_DESCRIPTIONS, OBJECT_DIR, OBJECT_INITIAL_KNOWN, OBJECT_LARGE_DAMAGE,
    OBJECT_MAGIC, OBJECT_MATERIAL, OBJECT_MATERIAL_NAMES, OBJECT_MERGE,
    OBJECT_NAMES, OBJECT_NOWISH, OBJECT_NUTRITION, OBJECT_PROB,
    OBJECT_PROPERTY_ID, OBJECT_SMALL_DAMAGE, OBJECT_TOUGH, OBJECT_UNIQUE,
    OBJECT_USES_KNOWN, OBJECT_WEIGHT,
} from '../object_data.js';
import { objectClassForType } from '../object_knowledge.js';
import { isPoisonableObject } from '../object_properties.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
    stopAllObjectTimers, stopObjectTimer,
} from '../object_timers.js';
import { readObjectName } from '../objnam.js';
import { addInventoryItem } from '../u_init.js';
import { objectWeight } from '../weight.js';
import { OBJECT_CLASS_SYMBOLS, objectTypeForName } from './des.js';
import { LuaTable, LuaUserdata, luaTableToObject, objectToLuaTable } from './runtime.js';

const LOCATIONS = {
    free: 0, floor: 1, contained: 2, inventory: 3, minvent: 4,
    migrating: 5, buried: 6, onbill: 7, gone: 8,
};
const OBJECT_FIELDS = `
    o_id ox oy otyp owt quan spe cursed blessed unpaid no_charge known dknown
    bknown rknown tknown oeroded2 oerodeproof olocked obroken recharged lamplit
    globby greased nomerge how_lost in_use bypass cknown lknown usecount oeaten
    age owornmask
`.trim().split(/\s+/);
const TIMER_KINDS = new Map([
    ['rot-organic', OBJECT_TIMER_KIND.ROT_ORGANIC], ['rot-corpse', OBJECT_TIMER_KIND.ROT_CORPSE],
    ['revive-mon', OBJECT_TIMER_KIND.REVIVE_MON], ['zombify-mon', OBJECT_TIMER_KIND.ZOMBIFY_MON],
    ['burn-obj', OBJECT_TIMER_KIND.BURN_OBJECT], ['hatch-egg', OBJECT_TIMER_KIND.HATCH_EGG],
    ['fig-transform', OBJECT_TIMER_KIND.FIG_TRANSFORM], ['shrink-glob', OBJECT_TIMER_KIND.SHRINK_GLOB],
    ['melt-ice', null],
]);
const ARGUMENT_COUNTS = {
    new: [1], isnull: [1], at: [2], next: [0, 1, 2], totable: [1], class: [1],
    contents: [1], container: [1], addcontent: [2], placeobj: [3],
    has_timer: [2], peek_timer: [2], stop_timer: [1, 2], start_timer: [3], bury: [1, 3],
};

function handle(value) {
    if (!(value instanceof LuaUserdata) || value.metatable.__name !== 'obj')
        throw new TypeError('object operation requires a Lua object');
    return value;
}

function object(value) {
    const item = handle(value).value;
    return item && item.where !== 'gone' ? item : null;
}

function timerKind(name) {
    if (!TIMER_KINDS.has(name))
        throw new TypeError(`Unknown object timer: ${name}`);
    return TIMER_KINDS.get(name);
}

function stopTimers(item, kind, state) {
    const stopped = kind === undefined ? stopAllObjectTimers(item)
        : [stopObjectTimer(item, kind)].filter(Boolean);
    for (const timer of stopped) {
        if (timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT)
            cleanupObjectBurn(item, timer.deadline, state);
    }
    return stopped;
}

function integer(value) {
    if (typeof value !== 'number' && typeof value !== 'string')
        throw new TypeError('object coordinates and timeouts must be integers');
    const number = Number(value);
    if (!Number.isInteger(number)) throw new TypeError('object coordinates and timeouts must be integers');
    return number;
}

export function createObjectApi(state = game) {
    const created = new Set();
    const collected = new FinalizationRegistry(reference => {
        created.delete(reference);
        state._luaObjectRefs?.delete(reference);
    });
    const api = {
        toAbsolute: (x, y) => ({ x, y }),
        wrap: item => new LuaUserdata(item, metatable),
        destroy() {
            for (const reference of created) {
                collected.unregister(reference);
                state._luaObjectRefs.delete(reference);
                const item = reference.deref();
                if (item?.where === 'free') deleteObject(item, state);
            }
            created.clear();
        },
        async give(itemHandle) {
            const item = object(itemHandle);
            if (!item || item.where === 'inventory') return;
            await detach(item);
            itemHandle.value = addInventoryItem(item);
        },
        async clearInventory() {
            for (const item of [...state.inventory]) {
                removeHeroEquipment(item, state);
                await detach(item);
                deleteObject(item, state);
            }
        },
    };

    async function detach(item) {
        const carried = item.where === 'inventory';
        unlinkObject(item, state);
        if (carried) await finishInventoryRemoval(item, state);
    }

    function create(value) {
        let item;
        if (typeof value === 'string') {
            item = readObjectName(value, { wizardWish: !!state.flags?.debug })?.object || null;
        } else if (value instanceof LuaTable) {
            const options = luaTableToObject(value);
            const type = options.id == null ? 0
                : objectTypeForName(options.id, options.class, state);
            const oclass = OBJECT_CLASS_SYMBOLS.indexOf(options.class);
            // ARROW is FIRST_OBJECT; earlier entries represent class glyphs.
            item = type < ARROW ? mkobj(Math.max(0, oclass), false)
                : mksobj(type, true, false);
        } else throw new TypeError('obj.new expects an object name or table');
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
            const point = api.toAbsolute(integer(x), integer(y));
            return api.wrap(state.level?.objects?.[point.x]?.[point.y]?.[0] || null);
        },
        next: (value, onSquare = false) => {
            if (value === undefined) return api.wrap(floorChain(state)[0] || null);
            const item = object(value);
            if (!item) return api.wrap(null);
            const chain = objectChain(item, onSquare != null && onSquare !== false, state);
            return api.wrap(chain[chain.indexOf(item) + 1] || null);
        },
        totable: value => objectTable(object(value), state),
        class: value => classTable(
            typeof value === 'number' ? value : handle(value).value?.otyp, state,
        ),
        contents: value => {
            const item = object(value);
            if (!item) throw new TypeError('cannot read contents of a null object');
            return api.wrap(item.contents?.[0] || null);
        },
        container: value => {
            const item = object(value);
            return api.wrap(item?.where === 'contained' ? item.container : null);
        },
        async addcontent(boxHandle, itemHandle) {
            const box = object(boxHandle), item = object(itemHandle);
            if (!box || !item) return;
            await detach(item);
            itemHandle.value = addObjectToContainer(box, item, state);
            box.owt = objectWeight(box);
        },
        async placeobj(value, x, y) {
            const item = object(value);
            const point = api.toAbsolute(integer(x), integer(y));
            if (!item) return;
            await detach(item);
            place_object(item, point.x, point.y, state);
            newsym(point.x, point.y);
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
            const kind = timerKind(name), when = integer(timeout);
            const item = object(value);
            if (item && kind && when > 0) {
                stopTimers(item, kind, state);
                scheduleObjectTimer(item, kind, state.moves + when, state);
            }
        },
        async bury(value, x, y) {
            const item = object(value);
            if (!item) return false;
            const point = x === undefined ? { x: item.ox, y: item.oy }
                : api.toAbsolute(integer(x), integer(y));
            if (!isok(point.x, point.y) || !canBuryObject(item)) return false;
            await detach(item);
            item.ox = point.x;
            item.oy = point.y;
            return buryUnlinkedObject(item, state) === null;
        },
    };
    for (const [name, counts] of Object.entries(ARGUMENT_COUNTS)) {
        const operation = methods[name];
        methods[name] = (...args) => {
            if (!counts.includes(args.length))
                throw new TypeError(`obj.${name} expects ${counts.join(' or ')} arguments, got ${args.length}`);
            return operation(...args);
        };
    }
    api.bindings = objectToLuaTable(methods);
    const metatable = { __name: 'obj', __index: api.bindings };
    return api;
}

function floorChain(state) {
    return (state.level?.objects || []).flatMap(column =>
        (column || []).flatMap(pile => pile || []))
        .sort((a, b) => (b._fobjOrder || 0) - (a._fobjOrder || 0));
}

function objectChain(item, onSquare, state) {
    switch (item.where) {
    case 'floor': return onSquare ? state.level.objects[item.ox][item.oy] : floorChain(state);
    case 'contained': return item.container?.contents || [];
    case 'inventory': return state.inventory;
    case 'minvent': return state.level.monsters.find(monster =>
        monster.m_id === item.carrierMid)?.minvent || [];
    case 'buried': return state.level.buriedObjects;
    case 'migrating': return state.migratingObjects;
    default: return [];
    }
}

function objectTable(item, state) {
    if (!item) return objectToLuaTable({ NO_OBJ: 1 });
    const values = Object.fromEntries(OBJECT_FIELDS.map(field => [field, Number(item[field] || 0)]));
    Object.assign(values, {
        has_contents: Number(!!item.contents?.length), is_container: Number(isContainer(item)),
        otyp_name: OBJECT_NAMES[item.otyp],
        otyp_descr: state.objectDescriptions?.[item.otyp] ?? OBJECT_DESCRIPTIONS[item.otyp],
        oclass: OBJECT_CLASS_SYMBOLS[item.oclass], invlet: item.invlet || '',
        where: LOCATIONS[item.where], corpsenm: item.corpsenm ?? -1,
    });
    if (item.otyp === STATUE) values.historic = Number(!!(item.spe & CORPSTAT_HISTORIC));
    if (item.otyp === CORPSE || item.otyp === STATUE) {
        values.male = Number(!!(item.spe & CORPSTAT_MALE));
        values.female = Number(!!(item.spe & CORPSTAT_FEMALE));
    }
    if (item.oclass === 8) values.odiluted = Number(!!(item.odiluted || item.diluted));
    else values.oeroded = item.oeroded || 0;
    if (isPoisonableObject(item)) values.opoisoned = Number(!!item.opoisoned);
    else values.otrapped = Number(!!item.otrapped);
    if ([TIN, CORPSE, EGG, FIGURINE, STATUE].includes(item.otyp) && item.corpsenm >= 0)
        values.corpsenm_name = MONSTER_NAME[item.corpsenm];
    const name = item.oextra?.oname || item.oname;
    values.has_oname = Number(!!name);
    if (name) values.oname = name;
    return objectToLuaTable(values);
}

function classTable(type, state) {
    if (!Number.isInteger(type) || type < 0 || type >= OBJECT_NAMES.length)
        throw new TypeError('obj.class requires an object or object type');
    return objectToLuaTable({
        name: OBJECT_NAMES[type],
        descr: state.objectDescriptions?.[type] ?? OBJECT_DESCRIPTIONS[type],
        uname: state._objectCallNames?.[type],
        name_known: Number(!!OBJECT_INITIAL_KNOWN[type] || !!state._knownObjectTypes?.has(type)),
        encountered: Number(!!state._encounteredObjectTypes?.has(type)),
        merge: OBJECT_MERGE[type], uses_known: OBJECT_USES_KNOWN[type],
        magic: OBJECT_MAGIC[type], charged: OBJECT_CHARGED[type],
        unique: OBJECT_UNIQUE[type], nowish: OBJECT_NOWISH[type],
        big: OBJECT_BIMANUAL[type], tough: state.objectToughness?.[type] ?? OBJECT_TOUGH[type],
        dir: OBJECT_DIR[type],
        material: OBJECT_MATERIAL_NAMES[state.objectMaterials?.[type] ?? OBJECT_MATERIAL[type]],
        oprop: OBJECT_PROPERTY_ID[type], class: OBJECT_CLASS_SYMBOLS[objectClassForType(type)],
        delay: OBJECT_DELAY[type], color: state.objectColors?.[type] ?? OBJECT_COLOR[type],
        prob: OBJECT_PROB[type], weight: OBJECT_WEIGHT[type], cost: OBJECT_COST[type],
        damage_small: OBJECT_SMALL_DAMAGE[type], damage_large: OBJECT_LARGE_DAMAGE[type],
        nutrition: OBJECT_NUTRITION[type],
    });
}
