import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { requirePlayingGame } from './gstate.js';
// Immediate magic owns each actual target; beam traversal and wand breakage
// choose those targets. C refs: zap.c bhito(), bhitpile(), zapsetup/wrapup().
import { A_WIS } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { changeBoxLockByMagic } from './box_magic.js';
import { reviveCorpseByMagic } from './corpse_revival.js';
import { canSpotMonster, newsym, plineWithContinuation as pline } from './display.js';
import { hitFloorObjectWithForce } from './force_bolt.js';
import { game } from './gstate.js';
import { probeObject } from './magic_probe.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { MONSTER_FLAGS2, MONSTER_NAME, monsterIsNonliving } from './monster_data.js';
import { monsterName, namelessMonsterName } from './monster_name.js';
import { cancelObjectMagic } from './object_cancellation.js';
import {
    BOULDER, CHEST, CORPSE, LARGE_BOX, OBJECT_NAMES, SPE_EXTRA_HEALING, SPE_FORCE_BOLT,
    SPE_HEALING, SPE_POLYMORPH, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY,
    SPE_TURN_UNDEAD, WAN_CANCELLATION, WAN_MAKE_INVISIBLE, WAN_POLYMORPH,
    WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION,
    WAN_UNDEAD_TURNING,
} from './object_data.js';
import { objectName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import {
    createPolymorphMonsterFromPile, polymorphFloorObject, stone_to_flesh_obj,
} from './object_polymorph.js';
import { drainObjectEnchantment } from './object_state.js';
import { relocateObjectRandomly } from './object_teleport.js';
import { objectsInTimerGraph } from './object_timers.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { unpunishHero } from './punishment.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { turnObjectWithUndeadMagic } from './undead_turning.js';
import { cansee } from './vision.js';
import { learnWand } from './wand_charge.js';

export { hitMonsterWithWand } from './immediate_monster_magic.js';

const WAN_OPENING = OBJECT_NAMES.indexOf('opening');
const WAN_LOCKING = OBJECT_NAMES.indexOf('locking');
const WAN_PROBING = OBJECT_NAMES.indexOf('probing');
const WAN_NOTHING = OBJECT_NAMES.indexOf('nothing');
const SPE_KNOCK = OBJECT_NAMES.indexOf('knock');
const SPE_WIZARD_LOCK = OBJECT_NAMES.indexOf('wizard lock');
const SPE_CANCELLATION = OBJECT_NAMES.indexOf('cancellation');
const SPE_DRAIN_LIFE = OBJECT_NAMES.indexOf('drain life');

export function beginImmediateZap(state: GameState = game) {

    state.context.obj_zapped = false;
}

export async function finishImmediateZap(state: GameState = game) {
    if (state.context?.obj_zapped) await pline('You feel shuddering vibrations.');
    state.context.obj_zapped = false;
}

// Native clear_bypasses runs once per turn, after the complete zap transaction.
export function clearImmediateZapBypasses(state: GameState = game) {
    for (const object of objectsInTimerGraph(state)) object.bypass = false;
    const clearChain = (objects: readonly GameObject[] | undefined): void => {
        for (const object of objects || []) {
            object.bypass = false;
            clearChain(object.contents);
        }
    };
    clearChain(state.billObjects);
    for (const monster of state._migratingMonsters || [])
        clearChain(monster.minvent || monster.inventory);
    for (const monster of state.level?.monsters || []) {
        if (monster.dead || monster.mhp <= 0 || MONSTER_NAME[monster.mnum] !== 'long worm') continue;
        if (Number.isInteger(monster.mcorpsenm)) monster.mcorpsenm = -1;
        if (monster.mextra && Number.isInteger(monster.mextra.mcorpsenm)) monster.mextra.mcorpsenm = -1;
    }
    if (state.context) state.context.bypasses = false;
}

export async function hitFloorPileWithWand(wand: GameObject, x: number, y: number, { state = game, direction = 0 }: { state?: GameState; direction?: number } = {}): Promise<number> {
    requirePlayingGame(state);
    const column = state.level.objects[x];
    const original = column?.[y] || [];
    if (!column || !original.length) return 0;
    const hiding = direction !== 0 && state.u.uundetected && heroFormHidesUnderObjects(state);
    let first = true;
    if ([WAN_STRIKING, SPE_FORCE_BOLT].includes(wand.otyp)) {
        const top = original[0];
        if (await activateStatueTrapAt(x, y, { state, shatter: true })) learnWand(wand, { state });
        if (column[y]?.[0] !== top) first = false;
    }

    state.context.poly_zapped = -1;
    let affected = 0;
    for (const object of [...(column[y] || [])]) {
        if (hiding) {
            if (first) {
                first = false;
                if (direction > 0) continue;
            } else if (direction < 0) continue;
        }
        if (object.where !== 'floor' || object.ox !== x || object.oy !== y) continue;
        affected += await hitObjectWithWand(object, wand, { state });
        if (state.program_state?.gameover) return affected;
    }
    if (state.context.poly_zapped >= 0) await createPolymorphMonsterFromPile(x, y, { state });
    const pile = column[y] || [];
    // Recreate the native pile order only if polymorph left a boulder below
    // another object. Both groups retain their existing internal order.
    if (pile.some((object, index) => object.otyp === BOULDER
        && pile.slice(0, index).some(earlier => earlier.otyp !== BOULDER))) {
        column[y] = [
            ...pile.filter(object => object.otyp === BOULDER),
            ...pile.filter(object => object.otyp !== BOULDER),
        ];
    }
    if (hiding) maybeUnhideAt(x, y, state);
    await fillPitWithBoulderAt(x, y, state);
    return affected;
}

export async function hitObjectWithWand(object: GameObject, wand: GameObject, { state = game }: { state?: GameState } = {}): Promise<number> {
    requirePlayingGame(state);
    if (object === wand) return 0;
    if (object.bypass) {
        if (state.context?.bypasses) return 0;
        object.bypass = false;
    }
    if (object.where !== 'floor' && wand.otyp !== SPE_STONE_TO_FLESH)
        throw new Error('Immediate object magic requires a floor object or stone to flesh');
    if (object === state.uball || object === state.u.uball) return 0;
    if (object === state.uchain || object === state.u.uchain) {
        if (![WAN_OPENING, SPE_KNOCK].includes(wand.otyp)) return 0;
        await unpunishHero(state);
        learnWand(wand, { state });
        return 1;
    }
    let affected = 1, learned = false;
    switch (wand.otyp) {
    case WAN_POLYMORPH:
    case SPE_POLYMORPH: {
        const result = await polymorphFloorObject(object, { state });
        affected = Number(result.affected);
        learned = result.learned;
        break;
    }
    case WAN_PROBING:
        learned = await probeObject(object, { state });
        affected = Number(learned);
        break;
    case WAN_STRIKING:
    case SPE_FORCE_BOLT: {
        const result = await hitFloorObjectWithForce(object, { state });
        learned = result.learned;
        affected = result.affected;
        break;
    }
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
        await cancelObjectMagic(object, { state });
        newsym(object.ox, object.oy);
        break;
    case SPE_DRAIN_LIFE:
        await drainObjectEnchantment(object, { state, byHero: true });
        break;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY: {
        const x = object.ox, y = object.oy;
        await relocateObjectRandomly(object, { state });
        maybeUnhideAt(x, y, state);
        break;
    }
    case WAN_MAKE_INVISIBLE:
        break;
    case WAN_UNDEAD_TURNING:
    case SPE_TURN_UNDEAD:
        if (object.otyp === CORPSE) {
            const result = await reviveFloorCorpse(object, state);
            affected = Number(result.affected);
            learned = result.learned;
        } else affected = Number(await turnObjectWithUndeadMagic(object, state));
        break;
    case WAN_OPENING:
    case SPE_KNOCK:
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        learned = [CHEST, LARGE_BOX].includes(object.otyp)
            && await changeBoxLockByMagic(object, wand, { state });
        affected = Number(learned);
        break;
    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
    case WAN_SPEED_MONSTER:
    case WAN_NOTHING:
    case SPE_HEALING:
    case SPE_EXTRA_HEALING:
        affected = 0;
        break;
    case SPE_STONE_TO_FLESH:
        affected = await stone_to_flesh_obj(object, { state });
        break;
    default:
        throw new Error(`No immediate object effect for ${OBJECT_NAMES[wand.otyp] || wand.otyp}`);
    }
    if (learned) learnWand(wand, { state });
    return affected;
}

async function reviveFloorCorpse(object: GameObject, state: PlayingGameState) {
    const x = object.ox, y = object.oy, species = object.corpsenm ?? -1;
    const corpseName = objectName(object);
    const event = await reviveCorpseByMagic(object, state);
    if (event?.kind !== 'revived') return { affected: false, learned: false };
    for (const message of event.messages || []) await pline(message);
    const monster = event.monster;
    let learned = false;
    if (cansee(x, y)) {
        if (canSpotMonster(monster)) {
            const name = namelessMonsterName(monster, { state, article: 'the' });
            await pline(`${name.charAt(0).toUpperCase()}${name.slice(1)} is resurrected!`);
            learned = !state.context?.mon_moving || !!state.context.zap_oseen;
        } else await pline(`${(MONSTER_FLAGS2[species] ?? 0) & 0x80000 ? '' : 'The '}${corpseName} disappears.`);
    } else {
        if (state.urole.key === 'healer' && !heroIsDeaf(state) && !monsterIsNonliving(species)) {
            const corpse = (MONSTER_FLAGS2[species] ?? 0) & 0x80000
                ? corpseName : withIndefiniteArticle(corpseName);
            await pline(`You hear ${heroIsHallucinating(state) ? 'a defibrillator' : `${corpse} reviving`}.`);
            learned = !state.context?.mon_moving || !!state.context.zap_oseen;
        }
        if (canSpotMonster(monster)) await pline(`${monsterName(monster, { capitalized: true })} appears.`);
    }
    if (learned) await exerciseAttribute(A_WIS, true, state);
    return { affected: true, learned };
}
