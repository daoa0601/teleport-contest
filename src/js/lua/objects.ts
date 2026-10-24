// Lua object handles and operations. C nhlobj.c.

import { isok, CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE } from '../const.js';
import { buryObject } from '../buried_object.js';
import { isContainer } from '../container.js';
import { newsym } from '../display.js';
import { placeObject } from '../floor_object.js';
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
import { OBJECT_CLASS_SYMBOLS, objectClassForType } from '../object_knowledge.js';
import { isPoisonableObject } from '../object_properties.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
    stopAllObjectTimers, stopObjectTimer,
} from '../object_timers.js';
import { readObjectName } from '../objnam.js';
import { addInventoryItem } from '../u_init.js';
import { objectWeight } from '../weight.js';
import { objectTypeForName } from './des.js';
import { luaInteger } from './arguments.js';
import { LuaTable, LuaUserdata, luaTableToObject, objectToLuaTable } from './runtime.js';
import type { LuaHostObject, LuaMetatable, LuaNativeFunction, LuaValue } from './runtime.js';
import type { GameState } from '../game_state.js';
import type { GameObject } from '../object_types.js';

export interface ObjectApi {
    toAbsolute(x: number, y: number): { x: number; y: number };
    wrap(item: GameObject | null): ObjectHandle;
    destroy(): Promise<void>;
    give: LuaNativeFunction;
    clearInventory: LuaNativeFunction;
    bindings: LuaTable;
}

class ObjectHandle extends LuaUserdata<GameObject | null> {}
type TimerKind = typeof OBJECT_TIMER_KIND[keyof typeof OBJECT_TIMER_KIND];

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
] as const;
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
// arguments.
const ARGUMENT_COUNTS: Record<string, { min: number; max?: number }> = {
    new: { min: 1, max: 1 }, isnull: { min: 1 }, at: { min: 2, max: 2 },
    next: { min: 0 }, totable: { min: 1 }, class: { min: 1, max: 1 },
    contents: { min: 1 }, container: { min: 1 }, addcontent: { min: 2 },
    placeobj: { min: 3, max: 3 },
    has_timer: { min: 2, max: 2 }, peek_timer: { min: 2, max: 2 },
    stop_timer: { min: 1, max: 2 }, start_timer: { min: 3, max: 3 },
    bury: { min: 1, max: 3 },
};

function handle(value: LuaValue | undefined): ObjectHandle {
    if (!(value instanceof ObjectHandle))
        throw new TypeError('object operation requires a Lua object');
    return value;
}

function object(value: LuaValue | undefined): GameObject | null {
    const item = handle(value).value;
    return item && item.where !== 'gone' ? item : null;
}

function timerKind(name: LuaValue | undefined): TimerKind | null {
    if (typeof name !== 'string' || !TIMER_KINDS.has(name))
        throw new TypeError(`Unknown object timer: ${name}`);
    return TIMER_KINDS.get(name) ?? null;
}

function stopTimers(item: GameObject | null, kind: TimerKind | null | undefined, state: GameState) {
    if (!item) return [];
    const stopped = kind === undefined ? stopAllObjectTimers(item)
        : [stopObjectTimer(item, kind)].filter(timer => timer != null);
    for (const timer of stopped) {
        if (timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT)
            cleanupObjectBurn(item, timer.deadline, state);
    }
    return stopped;
}


export function createObjectApi(state: GameState = game): ObjectApi {
    const created = new Set<WeakRef<GameObject>>();
    const collected = new FinalizationRegistry<WeakRef<GameObject>>(reference => {
        created.delete(reference);
        state._luaObjectRefs?.delete(reference);
    });
    const api: ObjectApi = {
        bindings: new LuaTable(),
        toAbsolute: (x, y) => ({ x, y }),
        wrap: item => new ObjectHandle(item, metatable),
        async destroy() {
            for (const reference of created) {
                collected.unregister(reference);
                state._luaObjectRefs?.delete(reference);
                const item = reference.deref();
                if (item?.where === 'free') await deleteObject(item, state);
            }
            created.clear();
        },
        async give(itemHandle) {
            const item = object(itemHandle);
            if (!item || item.where === 'inventory') return;
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

    async function detach(item: GameObject) {
        const carried = item.where === 'inventory';
        unlinkObject(item, state);
        if (carried) await finishInventoryRemoval(item, state);
    }

    async function create(value: LuaValue | undefined): Promise<ObjectHandle> {
        let item: GameObject | null;
        if (typeof value === 'string') {
            const result = await readObjectName(value, { wizardWish: !!state.flags?.debug });
            item = result && !result.noWish ? result.object : null;
        } else if (value instanceof LuaTable) {
            const options = luaTableToObject(value);
            const type = options.id == null ? 0
                : objectTypeForName(options.id, options.class, state);
            const oclass = typeof options.class === 'string'
                ? OBJECT_CLASS_SYMBOLS.indexOf(options.class) : -1;
            // ARROW is FIRST_OBJECT; earlier entries represent class glyphs.
            item = type < ARROW ? await mkobj(Math.max(0, oclass), false)
                : await mksobj(type, true, false);
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

    const methods: Record<string, LuaNativeFunction> = {
        new: create,
        isnull: value => object(value) === null,
        at: (x, y) => {
            const point = api.toAbsolute(luaInteger(x), luaInteger(y));
            return api.wrap(state.level?.objects?.[point.x]?.[point.y]?.[0] || null);
        },
        next: (...args: LuaValue[]) => {
            const [value, flag] = args;
            if (value === undefined) return api.wrap(floorChain(state)[0] || null);
            const item = object(value);
            if (!item) return api.wrap(null);
            // l_obj_nextobj() reads its flag argument only at exactly two
            // arguments; with three or more it falls back to the nobj chain.
            const onSquare = args.length === 2 && flag != null && flag !== false;
            const chain = objectChain(item, onSquare, state);
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
            return api.wrap(item?.where === 'contained' ? item.container ?? null : null);
        },
        async addcontent(boxHandle, itemHandle) {
            const box = object(boxHandle), item = object(itemHandle);
            if (!box || !item) return;
            await detach(item);
            handle(itemHandle).value = await addObjectToContainer(box, item, state);
            box.owt = objectWeight(box);
        },
        async placeobj(value, x, y) {
            const item = object(value);
            const point = api.toAbsolute(luaInteger(x), luaInteger(y));
            if (!item) return;
            await detach(item);
            await placeObject(item, point.x, point.y, state);
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
            const kind = timerKind(name), when = luaInteger(timeout);
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
                : api.toAbsolute(luaInteger(x), luaInteger(y));
            if (!isok(point.x, point.y)) return false;
            item.ox = point.x;
            item.oy = point.y;
            const result = await buryObject(item, state);
            return result.outcome === 'absorbed';
        },
    };
    for (const [name, { min, max }] of Object.entries(ARGUMENT_COUNTS)) {
        const operation = methods[name];
        if (!operation) throw new Error(`Missing Lua object operation: ${name}`);
        methods[name] = (...args) => {
            if (args.length < min || (max !== undefined && args.length > max)) {
                throw new TypeError(`obj.${name} expects ${max === undefined
                    ? `at least ${min}` : min === max ? `${min}` : `${min} to ${max}`} arguments, got ${args.length}`);
            }
            return operation(...args);
        };
    }
    api.bindings = objectToLuaTable(methods);
    const metatable: LuaMetatable = { __name: 'obj', __index: api.bindings };
    return api;
}

function floorChain(state: GameState): GameObject[] {
    return (state.level?.objects || []).flatMap(column =>
        (column || []).flatMap(pile => pile || []))
        .sort((a, b) => (b._fobjOrder || 0) - (a._fobjOrder || 0));
}

function objectChain(item: GameObject, onSquare: boolean, state: GameState): GameObject[] {
    switch (item.where) {
    case 'floor': {
        if (!onSquare) return floorChain(state);
        if (!state.level) throw new Error('A floor object requires an active level');
        return state.level.objects[item.ox]?.[item.oy] ?? [];
    }
    case 'contained': return item.container?.contents || [];
    case 'inventory': return state.inventory;
    case 'minvent': {
        if (!state.level) throw new Error('A monster inventory requires an active level');
        return state.level.monsters.find(monster =>
            monster.m_id === item.carrierMid)?.minvent || [];
    }
    case 'buried': {
        if (!state.level) throw new Error('A buried object requires an active level');
        return state.level.buriedObjects ?? [];
    }
    case 'migrating': return state.migratingObjects ?? [];
    case 'onbill': return state.billObjects ?? [];
    case 'free':
    case 'gone': return [];
    }
}

function objectTable(item: GameObject | null, state: GameState): LuaTable {
    if (!item) return objectToLuaTable({ NO_OBJ: 1 });
    const values: LuaHostObject = Object.fromEntries(OBJECT_FIELDS.map(field => [field, Number(item[field] || 0)]));
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
    if (item.otyp === STATUE) values.historic = Number(!!(item.spe & CORPSTAT_HISTORIC));
    if (item.otyp === CORPSE || item.otyp === STATUE) {
        values.male = Number(!!(item.spe & CORPSTAT_MALE));
        values.female = Number(!!(item.spe & CORPSTAT_FEMALE));
    }
    if (item.oclass === 8) values.odiluted = Number(!!(item.odiluted || item.diluted));
    else values.oeroded = item.oeroded || 0;
    if (isPoisonableObject(item)) values.opoisoned = Number(!!item.opoisoned);
    else values.otrapped = Number(!!item.otrapped);
    if ([TIN, CORPSE, EGG, FIGURINE, STATUE].includes(item.otyp) && item.corpsenm != null && item.corpsenm >= 0)
        values.corpsenm_name = MONSTER_NAME[item.corpsenm];
    const name = item.oextra?.oname || item.oname;
    values.has_oname = Number(!!name);
    if (name) values.oname = name;
    return objectToLuaTable(values);
}

function classTable(type: number | undefined, state: GameState): LuaTable {
    if (typeof type !== 'number' || !Number.isInteger(type) || type < 0 || type >= OBJECT_NAMES.length)
        throw new TypeError('obj.class requires an object or object type');
    const material = state.objectMaterials?.[type] ?? OBJECT_MATERIAL[type];
    if (material === undefined)
        throw new Error(`Missing object material for type ${type}`);
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
        material: OBJECT_MATERIAL_NAMES[material],
        oprop: OBJECT_PROPERTY_ID[type], class: OBJECT_CLASS_SYMBOLS[objectClassForType(type)],
        delay: OBJECT_DELAY[type], color: state.objectColors?.[type] ?? OBJECT_COLOR[type],
        prob: OBJECT_PROB[type], weight: OBJECT_WEIGHT[type], cost: OBJECT_COST[type],
        damage_small: OBJECT_SMALL_DAMAGE[type], damage_large: OBJECT_LARGE_DAMAGE[type],
        nutrition: OBJECT_NUTRITION[type],
    });
}
