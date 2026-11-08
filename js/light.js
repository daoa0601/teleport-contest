// Object light and burn timers.
import { SCROLL_CLASS } from './objclass.js';
import { monsterHasMapPosition } from './steed.js';
import { wakeMonstersNearWithMessages, finishMonsterKilled, finishHeroMonsterKillOutcome } from './mon.js';
import { AD_BLND } from './monster_attack_types.js';
import { beginBallAndChainRedraw, finishBallAndChainMove } from './ball.js';
import { definiteObjectAction, objectNameIsPlural, ownedObjectName } from './objnam.js';
import { game, requirePlayingGame } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { beginObjectBurn, endObjectBurn, lightObjectIsGlobal, objectsInTimerGraph } from './timeout.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { artifactEmitsLight } from './artifact.js';
import { COLNO, CORR, COULD_SEE, Is_rogue_level, Is_waterlevel, PLNMSG_OBJ_GLOWS, ROWNO, SIZEOF_LIGHT_SOURCE, TEMP_LIT } from './const.js';
import { canSeeMonster, canSpotMonster, flush_screen, map_invisible } from './display.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, MAGIC_LAMP, OIL_LAMP, POT_OIL, TALLOW_CANDLE, WAX_CANDLE, } from './object_data.js';
import { rnd } from './rng.js';
import { impactArtifactLight } from './potion.js';
import { cansee, clearAreaCells, vision_recalc, clearPath, monsterEmitsLight, circle_data, circle_start, visionRow, visionValue, } from './vision.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { carriedObjectOwner } from './shk.js';
import { getObjectLocation } from './zap.js';
import { placeObjectSynchronously, remove_object } from './mkobj.js';
import { roomForRoomno } from './hack.js';
import { snuffLitObject } from './apply.js';
import { monsterDigests, monsterIsWhirly } from './mondata.js';
import { showDisclosureOverlay } from './windows.js';
// C light.c:41 LSF_SHOW — the only flag set on a live, displayed source.
const LSF_SHOW = 0x1;
export const CANDLE_TYPES = new Set([
    CANDELABRUM_OF_INVOCATION, TALLOW_CANDLE, WAX_CANDLE,
]);
export const TIMED_LIGHT_TYPES = new Set([
    BRASS_LANTERN, OIL_LAMP, POT_OIL, ...CANDLE_TYPES,
]);
export const LIGHT_TYPES = new Set([...TIMED_LIGHT_TYPES, MAGIC_LAMP]);
// C light.c:obj_sheds_light(): obj_is_burning() — lamplit and ignitable
// or an artifact light.
export function objectShedsLight(object) {
    return !!object?.lamplit
        && (LIGHT_TYPES.has(object.otyp) || artifactEmitsLight(object));
}
// C light.c:candle_light_range(), arti_light_radius(): one object's light
// radius, including the gold-dragon scales and candelabrum ranges.
export function objectLightRadius(object, state = game) {
    if (!object?.lamplit)
        return 0;
    // Clearing a worn slot precedes the message and the call that extinguishes it.
    const goldArmor = object.otyp === GOLD_DRAGON_SCALE_MAIL || object.otyp === GOLD_DRAGON_SCALES;
    if (goldArmor || artifactEmitsLight(object)) {
        if (object === state.uskin)
            return 1;
        const radius = object.blessed ? 3 : object.cursed ? 1 : 2;
        return radius + Number(object.otyp === GOLD_DRAGON_SCALE_MAIL);
    }
    if (object.otyp === POT_OIL)
        return 1;
    if (object.otyp === CANDELABRUM_OF_INVOCATION)
        return object.spe < 4 ? 2 : object.spe < 7 ? 3 : 4;
    if (object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE)
        return Math.min(15, Math.floor(Math.sqrt(object.quan ?? object.quantity ?? 1)) + 1);
    return LIGHT_TYPES.has(object.otyp) ? 3 : 0;
}
// C light.c:arti_light_description(): the adverb for the current radius.
export function equipmentLightDescription(object, state = game) {
    return ['strangely', 'dimly', 'brightly', 'brilliantly', 'radiantly'][objectLightRadius(object, state)] || 'strangely';
}
// Part of C wield.c:ready_weapon(), worn.c:m_dowear_type(): the shared
// "begins to shine %s" / "stops shining" phrasing.
export function equipmentLightMessage(object, shining, state = game) {
    return shining
        ? `${definiteObjectAction(object, 'begin', state)} to shine ${equipmentLightDescription(object, state)}!`
        : `${definiteObjectAction(object, 'stop', state)} shining.`;
}
// Part of C wield.c:ready_weapon(): begin_burn() plus the shine message
// for a wielded light artifact.
export async function lightWieldedArtifact(object, state = game, publish = plineWithContinuation) {
    if (!artifactEmitsLight(object) || object.lamplit)
        return;
    beginObjectBurn(object, state);
    if (!heroIsBlind(state))
        await publish(equipmentLightMessage(object, true, state));
}
// Part of C light.c:snuff_light_source(): the end_burn() half that skips
// artifact lights.
function snuffOrdinaryLight(object) {
    if (!object?.lamplit || !LIGHT_TYPES.has(object.otyp))
        return false;
    return endObjectBurn(object, game, game.moves ?? 0);
}
// C light.c:snuff_light_source().  The native light_base list is
// newest-first and the search returns once one source at the location has
// been extinguished, so a square holding several burning objects keeps
// every one of them lit except the one closest to the list head.  _litSeq
// tracks that list position: raising on each lighting, and reversed by
// restoreLightSourceBatch() below when C would reload a saved batch.
export function snuffLightSource(x, y, state = game) {
    const candidates = [...(state.level?.objects?.[x]?.[y] || [])];
    const carrier = state.level?.monsters?.find(monster => monster.mx === x && monster.my === y);
    const inventories = new Set([carrier?.minvent, carrier?.inventory]);
    for (const inventory of inventories)
        candidates.push(...(inventory || []));
    if (state.u?.ux === x && state.u?.uy === y)
        candidates.push(...(state.inventory || []));
    let target = null;
    let newest = -1;
    for (const object of candidates) {
        if (!objectShedsLight(object) || artifactEmitsLight(object))
            continue;
        const order = object._litSeq ?? 0;
        if (order > newest) {
            newest = order;
            target = object;
        }
    }
    if (target)
        snuffOrdinaryLight(target);
}
// C light.c:save_light_sources() writes a batch (the global lights, or one
// level's lights) newest-first, and restore_light_sources()
// (light.c:487-491) pushes each entry back onto the front of light_base, so
// a restored batch returns reversed and ahead of the lights that never left
// the list.  Re-stamp the batch the same way: previously-oldest first,
// above every other light.
function restoreLightBatch(lights, state) {
    const batch = [...lights].sort((left, right) => left.seq - right.seq);
    if (!batch.length)
        return;
    const base = state._lightSerial ?? 0;
    batch.forEach((light, index) => light.restamp(base + batch.length - index));
    state._lightSerial = base + batch.length;
}
function objectLightEntries(objects, state) {
    const entries = [];
    for (const object of objects) {
        if (objectLightRadius(object, state) <= 0)
            continue;
        entries.push({
            seq: object._litSeq ?? 0,
            restamp: serial => { object._litSeq = serial; },
        });
    }
    return entries;
}
// Part of C restore.c:getlev(): the level-local light-source restoration.
// C getlev() restores the entered level's light sources after the level
// data (restore.c:1145); other levels keep waiting in their files.  The
// batch also carries the level's resident light-emitting monsters
// (light.c:452-453 saves a monster's source with its level when
// mon_is_local(), mx > 0).  Migrating monsters (mx 0) stay in the global
// batch, and the hero's youmonst.mx is pinned to 0 (light.c:16-17), so the
// hero's light stays in the list during a level change.
export function restoreLevelLightSources(state = game) {
    const lights = objectLightEntries(objectsInTimerGraph(state).filter(object => !lightObjectIsGlobal(object)), state);
    for (const monster of state.level?.monsters ?? []) {
        if (monster.dead || monster.lightRemoved || monster.mx <= 0
            || !monsterEmitsLight(monster.mnum))
            continue;
        lights.push({
            seq: monster._lightSeq ?? 0,
            restamp: serial => { monster._lightSeq = serial; },
        });
    }
    restoreLightBatch(lights, state);
}
// C restore.c:655 reloads the global batch while reading the game state,
// then getlev() pushes the current level's batch in front of it.
export function restoreSavedLightSources(state = game) {
    const lights = objectLightEntries(objectsInTimerGraph(state).filter(lightObjectIsGlobal), state);
    // youmonst.mx is always 0 (light.c:16-17), so maybe_write_ls():586
    // includes the hero: "is_global = !mon_is_local(ls->id.a_monst)".
    if (state.u.formLightRange) {
        lights.push({
            seq: state.u.formLightSeq ?? 0,
            restamp: serial => { state.u.formLightSeq = serial; },
        });
    }
    // The global batch keeps the migrating monsters' lights (mx 0).
    for (const monster of state._migratingMonsters ?? []) {
        if (monster.dead || monster.lightRemoved || !monsterEmitsLight(monster.mnum))
            continue;
        lights.push({
            seq: monster._lightSeq ?? 0,
            restamp: serial => { monster._lightSeq = serial; },
        });
    }
    restoreLightBatch(lights, state);
    restoreLevelLightSources(state);
}
// Part of C mhitm.c:gulpmm(): the engulfed inventory light pass, shared with uhitm.c:gulpum().
// The engulf loops at mhitm.c:868 and uhitm.c:4985 inline this pass: every
// light a swallowed actor carries is snuffed with apply.c:snuff_lit()
// semantics (apply.ts:snuffLitObject is its port), the carrier's square
// deciding visibility.
export async function snuffMonsterInventoryLights(defender, state, publish) {
    for (const object of defender.minvent || defender.inventory || []) {
        if (!object.lamplit)
            continue;
        const lamp = [OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL].includes(object.otyp);
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        const candelabrum = object.otyp === CANDELABRUM_OF_INVOCATION;
        if (!lamp && !candle && !candelabrum)
            continue;
        if (cansee(defender.mx, defender.my)) {
            if (lamp)
                await publish(`${ownedObjectName(object, state)} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
            else {
                const many = candle ? object.quan > 1 : object.spe > 1;
                await publish(`${carriedObjectOwner(object, state)} ${candelabrum ? "candelabrum's " : ''}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
            }
        }
        endObjectBurn(object, state);
    }
}
// Port only: derive moving light sources from live monsters and objects instead of a native light list.
function mobileLightSources(level) {
    const monsters = [...(level?.monsters || [])];
    const sources = monsters.filter(monster => !monster.dead && !monster.lightRemoved && !monster.mburied
        && monster.mx > 0 && monsterEmitsLight(monster.mnum))
        .map(monster => ({ x: monster.mx, y: monster.my, range: 1 }));
    if (game.u.formLightRange)
        sources.push({ x: game.u.ux, y: game.u.uy, range: game.u.formLightRange });
    const addObjectLight = (object, x, y) => {
        const range = objectLightRadius(object);
        if (range)
            sources.push({ x, y, range });
    };
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            for (const object of level?.objects?.[x]?.[y] || [])
                addObjectLight(object, x, y);
    for (const object of game.inventory || [])
        addObjectLight(object, game.u.ux, game.u.uy);
    for (const monster of monsters) {
        if (monster.dead || monster.mx < 1)
            continue;
        for (const object of monster.minvent || monster.inventory || [])
            addObjectLight(object, monster.mx, monster.my);
    }
    sources.push(...(game._transientLights || []));
    return sources;
}
// C light.c:any_light_source(). The monster pass must request a refresh even
// when the hero stays still: a monster can move its own light or a lit object.
export function hasLightSources() {
    // Sources in containers, underground, or in transit still exist even
    // when get_obj_location()/get_mon_location() cannot expose their light.
    return !!game._transientLights?.length
        || !!game.u.formLightRange
        || [...(game.level?.monsters ?? []), ...(game._migratingMonsters ?? [])]
            .some(monster => !monster.dead && !monster.lightRemoved && monsterEmitsLight(monster.mnum))
        || objectsInTimerGraph(game).some(object => objectLightRadius(object) > 0);
}
// C light.c:do_light_sources()
export function doLightSources(level, couldSee) {
    refreshLightSourcePositions(game);
    let atHeroRange = 0;
    for (const source of mobileLightSources(level)) {
        const atHero = source.x === game.u.ux && source.y === game.u.uy;
        if (atHero) {
            if (atHeroRange >= source.range)
                continue;
            atHeroRange = source.range;
        }
        const limits = visionValue(circle_start, source.range);
        for (let y = Math.max(0, source.y - source.range); y <= Math.min(ROWNO - 1, source.y + source.range); y++) {
            const offset = visionValue(circle_data, limits + Math.abs(y - source.y));
            for (let x = Math.max(1, source.x - offset); x <= Math.min(COLNO - 1, source.x + offset); x++) {
                if (atHero ? ((couldSee[y]?.[x] ?? 0) & COULD_SEE)
                    : ((source.x === x && source.y === y)
                        || clearPath(source.x, source.y, x, y))) {
                    const row = visionRow(couldSee, y);
                    row[x] = visionValue(row, x) | TEMP_LIT;
                }
            }
        }
    }
}
// C light.c:show_transient_light(). A thrown or kicked lit object lights its
// flight; a null object is an camera flash lighting one square.
export async function showTransientLight(object, x, y, state = game) {
    requirePlayingGame(state);
    if (!object && state.level.requireAt(x, y).lit)
        return;
    const range = object ? objectLightRadius(object, state) : 0;
    if (object) {
        if (!range || object.where !== 'free')
            throw new Error(`Transient light requires a free, lit object: ${object.o_id}`);
        placeObjectSynchronously(object, x, y, state);
    }
    else {
        (state._transientLights ??= []).unshift({ x, y, range: 0, show: false });
    }
    try {
        await vision_recalc(0);
        await flush_screen(0);
        for (const monster of state.level.monsters) {
            if (monster.dead || monster.mhp <= 0 || monster.isgd && !monster.mx)
                continue;
            const distance = (monster.mx - x) ** 2 + (monster.my - y) ** 2;
            if (distance <= range * range && canSeeMonster(monster))
                monster.mtemplit = 1;
        }
        if (object)
            await state.animationFrame?.();
    }
    finally {
        if (object)
            remove_object(object, state);
    }
}
// C light.c:transient_light_cleanup().
export async function cleanupTransientLight(state = game) {
    requirePlayingGame(state);
    discardFlashes(state);
    if (state.vision_full_recalc)
        await vision_recalc(0);
    let changed = false;
    for (const monster of state.level.monsters) {
        if (monster.dead || monster.mhp <= 0 || !monster.mtemplit)
            continue;
        monster.mtemplit = 0;
        changed = true;
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
    }
    if (changed)
        await flush_screen(0);
}
// C light.c:discard_flashes().
export function discardFlashes(state = game) {
    if (!state._transientLights?.length)
        return;
    delete state._transientLights;
    state.vision_full_recalc = 1;
}
// C light.c:new_light_source() prepends to light_base, so each lighting
// gives the object the newest slot in the list order that snuff searches.
// Also C light.c:new_light_core(): new_light_source() is only a thin
// wrapper around this core.
export function registerObjectLightSource(object, state) {
    state._lightSerial = (state._lightSerial ?? 0) + 1;
    object._litSeq = state._lightSerial;
    // C timeout.c:1792 includes contained and buried objects at creation.
    const location = getObjectLocation(object, state, { contained: true, buried: true });
    object._lightPosition = { x: location?.x ?? 0, y: location?.y ?? 0, show: false };
}
// C light.c:new_light_source() for monster sources: makemon.c:1349 registers
// a light-emitting newborn, makemon.c:900 its clone, and mon.c:2541/5404 a
// replacement form that emits light.  The stamp shares the object serial so
// the #lightsources order and the at-hero LSF_SHOW pass follow native
// registration order.
export function registerMonsterLightSource(monster, state) {
    state._lightSerial = (state._lightSerial ?? 0) + 1;
    monster._lightSeq = state._lightSerial;
    monster._lightPosition = { x: monster.mx, y: monster.my, show: false };
}
// C light.c:new_light_source() for the hero's shape light
// (polyself.c:726-731).
export function registerHeroFormLightSource(state) {
    state._lightSerial = (state._lightSerial ?? 0) + 1;
    state.u.formLightSeq = state._lightSerial;
    state.u.formLightPosition = { x: state.u.ux, y: state.u.uy, show: false };
}
// Part of C light.c:do_light_sources(): resolve moved sources and suppress
// duplicates at the hero. Its loop follows "ls = gl.light_base; ls;
// ls = ls->next" (light.c:178). The Blind branch of vision_recalc()
// jumps past this pass (vision.c:583,703).
function refreshLightSourcePositions(state) {
    const sources = [];
    for (const object of objectsInTimerGraph(state)) {
        if (!objectShedsLight(object))
            continue;
        const location = getObjectLocation(object, state);
        const position = { x: location?.x ?? 0, y: location?.y ?? 0, show: !!location };
        object._lightPosition = position;
        sources.push({ position, range: objectLightRadius(object, state), seq: object._litSeq ?? 0 });
    }
    for (const monster of [...(state.level?.monsters ?? []), ...(state._migratingMonsters ?? [])]) {
        if (monster.dead || monster.lightRemoved || !monsterEmitsLight(monster.mnum))
            continue;
        const located = monster.mx > 0 && !monster.mburied;
        const position = {
            x: located ? monster.mx : 0, y: located ? monster.my : 0, show: located,
        };
        monster._lightPosition = position;
        sources.push({ position, range: 1, seq: monster._lightSeq ?? 0 });
    }
    if (state.u.formLightRange) {
        const position = { x: state.u.ux, y: state.u.uy, show: true };
        state.u.formLightPosition = position;
        sources.push({ position, range: state.u.formLightRange, seq: state.u.formLightSeq ?? 0 });
    }
    for (const flash of state._transientLights ?? []) {
        flash.show = true;
        sources.push({ position: flash, range: flash.range, seq: Number.POSITIVE_INFINITY });
    }
    sources.sort((left, right) => right.seq - left.seq);
    let atHeroRange = 0;
    for (const { position, range } of sources) {
        if (position.x !== state.u.ux || position.y !== state.u.uy)
            continue;
        if (atHeroRange >= range)
            position.show = false;
        else
            atHeroRange = range;
    }
}
// Port only: enumerate every live light source the way C walks light_base,
// newest registration first (new_light_core() prepends).  Every registration
// shares the state._lightSerial stamp: object lights via
// registerObjectLightSource(), monster lights via
// registerMonsterLightSource() at birth or light-changing shape shift, and
// the hero's shape light via registerHeroFormLightSource().  A camera flash
// is newer than everything by construction.  Sources registered before
// their stamp existed keep seq 0 and fall to the tail in insertion order.
export function lightSourceRecords(state) {
    const records = [];
    for (const flash of state._transientLights || [])
        records.push({ x: flash.x, y: flash.y, range: flash.range, kind: 'obj',
            idText: '0x0', show: flash.show, seq: Number.POSITIVE_INFINITY });
    const objects = objectsInTimerGraph(state)
        .filter(object => objectShedsLight(object))
        .sort((left, right) => (right._litSeq ?? 0) - (left._litSeq ?? 0)
        || right.o_id - left.o_id);
    for (const object of objects) {
        const position = object._lightPosition;
        if (!position)
            throw new Error(`Object light ${object.o_id} has no cached position`);
        records.push({
            ...position,
            range: objectLightRadius(object, state),
            kind: 'obj',
            idText: `0x${object.o_id.toString(16)}`,
            seq: object._litSeq ?? 0,
        });
    }
    const monsters = [...(state.level?.monsters ?? []), ...(state._migratingMonsters ?? [])]
        .filter(monster => !monster.dead && !monster.lightRemoved
        && monsterEmitsLight(monster.mnum))
        .sort((left, right) => (right._lightSeq ?? 0) - (left._lightSeq ?? 0)
        || right.m_id - left.m_id);
    for (const monster of monsters) {
        const position = monster._lightPosition;
        if (!position)
            throw new Error(`Monster light ${monster.m_id} has no cached position`);
        records.push({
            ...position,
            range: 1,
            kind: monster.mx > 0 ? 'mon' : '<m>',
            idText: `0x${monster.m_id.toString(16)}`,
            seq: monster._lightSeq ?? 0,
        });
    }
    if (state.u.formLightRange) {
        const position = state.u.formLightPosition;
        if (!position)
            throw new Error('Hero form light has no cached position');
        records.push({ ...position, range: state.u.formLightRange,
            kind: 'you', idText: '0x1', seq: state.u.formLightSeq ?? 0 });
    }
    // light.c:83-90: each registration prepends, so the list is newest
    // first; the stable sort keeps insertion order between equal stamps.
    records.sort((left, right) => right.seq - left.seq);
    return records;
}
// C light.c:light_stats(): the #stats row over the light_base list — one
// light_source per entry.
export function lightStats(state = game) {
    const count = lightSourceRecords(state).length;
    return { header: `light sources, size ${SIZEOF_LIGHT_SOURCE}`, count, size: count * SIZEOF_LIGHT_SOURCE };
}
// C light.c:wiz_light_sources(): the #lightsources wizard listing in a
// putstr-built NHW_MENU window (a corner text window for the tty interface;
// the disclosure overlay owns that geometry).
export async function wizLightSources() {
    requirePlayingGame(game);
    const state = game;
    const hero = state.u;
    const lines = [
        `Mobile light sources: hero @ (${String(hero.ux).padStart(2)},${String(hero.uy).padStart(2)})`,
        '',
    ];
    const records = lightSourceRecords(state);
    if (records.length) {
        lines.push('location range flags  type    id', '-------- ----- ------ ----  -------');
        for (const record of records)
            lines.push(`  ${String(record.x).padStart(2)},${String(record.y).padStart(2)}   `
                + `${String(record.range).padStart(2)}   `
                + `0x${(record.show ? LSF_SHOW : 0).toString(16).padStart(4, '0')}  `
                + `${record.kind}  ${record.idText}`);
    }
    else {
        lines.push('<none>');
    }
    await showDisclosureOverlay(lines, { restoreUnderlay: true });
    state._pending_message = '';
    state._retained_message = '';
    state.context.move = 0;
}
// Part of C apply.c:dorub(): performs this type change before the released djinni can
// grant a fatal wish.  A lit magic lamp already has a light source but no
// timer; once it becomes an oil lamp, begin_burn(..., TRUE) attaches the
// ordinary fuel timer while preserving that light-source identity.
export function transformMagicLampToOilLamp(object, oilAge, state = game, currentTurn = state.moves ?? 0) {
    if (object?.otyp !== MAGIC_LAMP || !Number.isFinite(oilAge)
        || oilAge <= 0)
        return false;
    object.otyp = OIL_LAMP;
    object.name = 'oil lamp';
    object.plural = 'oil lamps';
    object.spe = 0;
    object.age = oilAge;
    if (object.lamplit)
        beginObjectBurn(object, state, currentTurn);
    return true;
}
//# sourceMappingURL=light.js.map