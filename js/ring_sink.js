// C refs: do.c dosinkring() (496-661), teleport_sink() (459-494), and
// polymorph_sink() (403-455).  The drop owner calls this when a ring (or
// meat ring) is dropped while the hero stands on a sink, above the floor
// reachability checks — so it also runs while levitating.
import { ALTAR, COLNO, FOUNTAIN, ROOM, ROWNO, SINK, THRONE, AM_NONE, Align2amask, } from './const.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { observeObjectForNaming } from './objnam.js';
import { displayColorName, displayLiquidName, newsym, plineWithContinuation, randomDisplayMonsterName, } from './display.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { formatHeardMessage } from './hero_speech.js';
import { tryCallObjectType } from './object_call.js';
import { objectResistsDestruction } from './object_state.js';
import { delobj } from './object_delete.js';
import { addBuriedObject } from './buried_object.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { floorObjectDescription } from './floor_object_display.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { engravingAt } from './engrave.js';
import { cansee } from './vision.js';
import { rnd, rn2 } from './rng.js';
import { ownedObjectName } from './objnam.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { make_grave } from './mklev.js';
const FRUIT_DEFAULT = 'slime mold';
// C turn_undead/other precedent: Gehennom by dungeon name.
function inGehennom(state) {
    const dnum = state.u?.uz?.dnum ?? -1;
    return state.dungeons?.[dnum]?.dname === 'Gehennom';
}
function fruitNamePlural(state) {
    return makePlural(state.fruitName || FRUIT_DEFAULT);
}
// C do.c:403-455 polymorph_sink(), shared shape with the fountain owner.
export async function polymorphSink(state, publish) {
    const { ux, uy } = state.u;
    const level = requireGameLevel(state);
    const location = level.requireAt(ux, uy);
    if (location.typ !== SINK)
        return;
    // C zeroes the rm flags union, which shares storage with looted,
    // blessedftn, and the altar mask: every per-square state clears, then
    // the chosen outcome re-arms its own.
    const sinkLooted = !!location.looted;
    const flags = level.flags;
    flags.nsinks = Math.max(0, (flags.nsinks ?? 0) - 1);
    location.looted = 0;
    location.blessedftn = 0;
    location.flags = 0;
    let symbolName;
    switch (rn2(4)) {
        default:
        case 0:
            symbolName = 'fountain';
            location.typ = FOUNTAIN;
            location.blessedftn = 0;
            if (sinkLooted)
                location.looted = 1;
            flags.nfountains = (flags.nfountains ?? 0) + 1;
            break;
        case 1:
            symbolName = 'throne';
            location.typ = THRONE;
            if (sinkLooted)
                location.looted = 1;
            break;
        case 2: {
            symbolName = 'altar';
            location.typ = ALTAR;
            const alignment = rn2(3) - 1; /* -1 Cha, 0 Neu, +1 Law */
            location.flags = (inGehennom(state) && rn2(3))
                ? AM_NONE
                : Align2amask(alignment);
            break;
        }
        case 3:
            symbolName = 'grave';
            location.typ = ROOM;
            make_grave(ux, uy, null);
            break;
    }
    // give message even if blind; we know we're not levitating, so we can
    // feel the outcome even if we can't directly see it
    if (location.typ !== ROOM)
        await publish(`The sink transforms into ${withIndefiniteArticle(symbolName)}!`);
    else
        await publish('The sink vanishes.');
    newsym(ux, uy);
}
// C do.c:459-494 teleport_sink(): move the sink to a far, unseen, plain
// room square.  Returns whether the sink moved.
function teleportSink(state) {
    const { ux, uy } = state.u;
    const level = requireGameLevel(state);
    const sink = level.requireAt(ux, uy);
    for (let tries = 0; tries < 200; tries++) {
        const cx = 1 + rnd((COLNO - 1) - 2); /* 2..COLNO-2 */
        const cy = 1 + rn2(ROWNO - 2); /* 1..ROWNO-2 */
        const location = level.requireAt(cx, cy);
        if (location.typ !== ROOM
            || level.traps.some(trap => trap.tx === cx && trap.ty === cy)
            || engravingAt(cx, cy, level))
            continue;
        const dx = cx - ux;
        const dy = cy - uy;
        if (cansee(cx, cy) && dx * dx + dy * dy <= 3 * 3)
            continue;
        const alreadyLooted = !!sink.looted;
        const flags = level.flags;
        flags.nsinks = Math.max(0, (flags.nsinks ?? 0) - 1);
        sink.typ = ROOM;
        sink.looted = 0;
        newsym(ux, uy);
        location.typ = SINK;
        location.looted = alreadyLooted ? 1 : 0;
        flags.nsinks = (flags.nsinks ?? 0) + 1;
        newsym(cx, cy);
        return true;
    }
    return false;
}
export async function dropRingIntoSink(object, { state = game, publish = plineWithContinuation } = {}) {
    // Full world mutation: terrain, floor inventory, burial, shop bills.
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const { ux, uy } = state.u;
    observeObjectForNaming(object, { state });
    await publish(`You drop ${inventoryItemDescription(object)} down the drain.`);
    object.in_use = true; /* block free identification via interrupt */
    let ideed = true;
    let nosink = false;
    switch (object.otyp) { /* effects that can be noticed without eyes */
        case 180: /* RIN_SEARCHING */
            await publish(`You thought ${ownedObjectName(object, state, { capitalized: false })} got`
                + ' lost in the sink, but there it is!');
            object.in_use = false;
            await dropInventoryObjectAtHero(object, { state, publish });
            await tryCallObjectType(object, state);
            return;
        case 193: /* RIN_SLOW_DIGESTION */
            await publish('The ring is regurgitated!');
            object.in_use = false;
            await dropInventoryObjectAtHero(object, { state, publish });
            await tryCallObjectType(object, state);
            return;
        case 183: /* RIN_LEVITATION */
            await publish('The sink quivers upward for a moment.');
            break;
        case 188: /* RIN_POISON_RESISTANCE */
            await publish(`You smell rotten ${fruitNamePlural(state)}.`);
            break;
        case 185: { /* RIN_AGGRAVATE_MONSTER */
            const swarm = heroIsHallucinating(state)
                ? makePlural(randomDisplayMonsterName()) : 'flies';
            await publish(`Several ${swarm} buzz angrily around the sink.`);
            break;
        }
        case 191: /* RIN_SHOCK_RESISTANCE */
            await publish('Static electricity surrounds the sink.');
            break;
        case 186: /* RIN_CONFLICT */ {
            const heard = formatHeardMessage('loud noises coming from the drain.', state);
            if (heard !== null)
                await publish(heard);
            break;
        }
        case 182: /* RIN_SUSTAIN_ABILITY */
            await publish(`The ${displayLiquidName('water', state)} flow seems fixed.`);
            break;
        case 174: /* RIN_GAIN_STRENGTH */
            await publish(`The ${displayLiquidName('water', state)} flow seems ${object.spe < 0 ? 'weak' : 'strong'}er now.`);
            break;
        case 175: /* RIN_GAIN_CONSTITUTION */
            await publish(`The ${displayLiquidName('water', state)} flow seems ${object.spe < 0 ? 'less' : 'great'}er now.`);
            break;
        case 176: /* RIN_INCREASE_ACCURACY */
            await publish(`The ${displayLiquidName('water', state)} flow ${object.spe < 0 ? 'misses' : 'hits'} the drain.`);
            break;
        case 177: /* RIN_INCREASE_DAMAGE */
            await publish(`The water's force seems ${object.spe < 0 ? 'small' : 'great'}er now.`);
            break;
        case 184: /* RIN_HUNGER */
            ideed = false;
            for (const pileObject of [...(level.objects[ux]?.[uy] || [])]) {
                if (pileObject === state.uball || pileObject === state.uchain)
                    continue;
                if (objectResistsDestruction(pileObject, 1, 99))
                    continue;
                if (!heroIsBlind(state)) {
                    observeObjectForNaming(pileObject, { state });
                    const quantity = pileObject.quan ?? pileObject.quantity ?? 1;
                    await publish(`Suddenly, ${floorObjectDescription(pileObject)} `
                        + `${quantity === 1 ? 'vanishes' : 'vanish'}`
                        + ' from the sink!');
                    ideed = true;
                }
                // C delobj: resistance gate, floor unlink with unhide/redraw,
                // and bill-preserving obfree.
                await delobj(pileObject, state);
            }
            break;
        case 270: /* MEAT_RING */
            await publish('Several flies buzz around the sink.');
            break;
        case 194: { /* RIN_TELEPORTATION */
            nosink = teleportSink(state);
            await publish(`The sink ${nosink ? '' : 'momentarily '}vanishes.`);
            ideed = false;
            break;
        }
        case 196: { /* RIN_POLYMORPH */
            await polymorphSink(state, publish);
            nosink = true;
            ideed = level.requireAt(ux, uy).typ !== ROOM;
            break;
        }
        default:
            ideed = false;
            break;
    }
    if (!heroIsBlind(state) && !ideed) {
        ideed = true;
        switch (object.otyp) { /* effects that need eyes */
            case 173: /* RIN_ADORNMENT */
                await publish('The faucets flash brightly for a moment.');
                break;
            case 179: /* RIN_REGENERATION */
                await publish('The sink looks as good as new.');
                break;
            case 198: /* RIN_INVISIBILITY */
                await publish("You don't see anything happen to the sink.");
                break;
            case 192: /* RIN_FREE_ACTION */
                await publish('You see the ring slide right down the drain!');
                break;
            case 199: /* RIN_SEE_INVISIBLE */
                await publish(`You see some ${heroIsHallucinating(state) ? 'oxygen molecules' : 'air'} in the sink.`);
                break;
            case 181: /* RIN_STEALTH */
                await publish('The sink seems to blend into the floor'
                    + ' for a moment.');
                break;
            case 189: /* RIN_FIRE_RESISTANCE */
                await publish(`The hot ${displayLiquidName('water', state)} faucet flashes`
                    + ' brightly for a moment.');
                break;
            case 190: /* RIN_COLD_RESISTANCE */
                await publish(`The cold ${displayLiquidName('water', state)} faucet flashes`
                    + ' brightly for a moment.');
                break;
            case 200: /* RIN_PROTECTION_FROM_SHAPE_CHANGERS */
                await publish('The sink looks nothing like a fountain.');
                break;
            case 178: /* RIN_PROTECTION */
                await publish(`The sink glows ${displayColorName(object.spe < 0 ? 'black' : 'silver', state)} for a moment.`);
                break;
            case 187: /* RIN_WARNING */
                await publish(`The sink glows ${displayColorName('white', state)} for a moment.`);
                break;
            case 195: /* RIN_TELEPORT_CONTROL */
                await publish('The sink looks like it is being beamed'
                    + ' aboard somewhere.');
                break;
            case 197: /* RIN_POLYMORPH_CONTROL */
                await publish('The sink momentarily looks like a regularly'
                    + ' erupting geyser.');
                break;
            default:
                break;
        }
    }
    if (ideed) {
        await tryCallObjectType(object, state);
    }
    else if (!nosink) {
        const heard = formatHeardMessage('the ring bouncing down the drainpipe.', state);
        if (heard !== null)
            await publish(heard);
    }
    if (rn2(20) === 0 && !nosink) {
        observeObjectForNaming(object, { state });
        await publish(`The sink backs up, leaving ${inventoryItemDescription(object)}.`);
        object.in_use = false;
        await dropInventoryObjectAtHero(object, { state, publish });
    }
    else if (rn2(5) === 0) {
        // C: freeinv (unlink from invent plus its hooks) then link into
        // the buried list (plain add_to_buried, not the floor-bury
        // mechanic).
        const index = state.inventory?.indexOf(object) ?? -1;
        if (index >= 0)
            state.inventory.splice(index, 1);
        await finishInventoryRemoval(object, state);
        object.in_use = false;
        addBuriedObject(object, ux, uy, state);
    }
    else {
        await consumeInventoryItem(object, state);
    }
}
//# sourceMappingURL=ring_sink.js.map