import { requirePlayingGame } from './gstate.js';
// C zap.c:zap_map(). Terrain is affected before occupants and floor piles.
import { ANTI_MAGIC, COLNO, CORR, DBWALL, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, ENGRAVE, EXPL_MAGICAL, HEADSTONE, ICE, Invocation_lev, IS_FURNITURE, Is_rogue_level, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, POLY_TRAP, ROWNO, SCORR, SDOOR, TELEP_TRAP, TRAP_EXPLODE, VIBRATING_SQUARE, } from './const.js';
import { revealSecretDoor, showMapSpot } from './detect.js';
import { closeDrawbridge, destroyDrawbridge, findDrawbridgeAt, openDrawbridge } from './dbridge.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { glyphAt, newsym, plineWithContinuation as pline, shieldeff } from './display.js';
import { forceDescribeDecor } from './dungeon_feature.js';
import { deleteEngravingAt, engravingAt, makeEngravingAt, wipeEngravingAt } from './engrave.js';
import { explode } from './explosion.js';
import { game } from './gstate.js';
import { randomEngraving } from './mklev.js';
import { SPE_CANCELLATION, SPE_FORCE_BOLT, SPE_KNOCK, SPE_POLYMORPH, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_WIZARD_LOCK, WAN_CANCELLATION, WAN_LOCKING, WAN_MAKE_INVISIBLE, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_STRIKING, WAN_TELEPORTATION, } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { d, rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { goodPosition } from './teleport_rules.js';
import { deleteTrap } from './trap_lifecycle.js';
import { trapName } from './trap_name.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { learnWand } from './wand_charge.js';
export async function zapMapAt(x, y, source, { state = game } = {}) {
    requirePlayingGame(state);
    let learned = await cancelMagicTrap(x, y, source, state);
    if (state.program_state.gameover)
        return;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if ((state.u.dz ?? 0) > 0)
        await zapEngraving(x, y, source, state);
    else if (!state.u.dz)
        learned = (await zapDrawbridge(x, y, source, state)) || learned;
    if (state.program_state.gameover)
        return;
    if (source.otyp === WAN_PROBING)
        learned = await probeTerrain(x, y, trap, learned, state);
    if (learned)
        learnWand(source, { state });
}
async function cancelMagicTrap(x, y, source, state) {
    if (![WAN_CANCELLATION, SPE_CANCELLATION].includes(source.otyp))
        return false;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap)
        return false;
    if ([MAGIC_PORTAL, VIBRATING_SQUARE].includes(trap.ttyp)) {
        await shieldeff(x, y);
        if (!cansee(x, y))
            return false;
        trap.tseen = 1;
        newsym(x, y);
        return true;
    }
    if (![TELEP_TRAP, LEVEL_TELEP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP].includes(trap.ttyp))
        return false;
    const visible = cansee(x, y);
    await explode(x, y, -WAN_CANCELLATION, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL, { state });
    deleteTrap(trap, state);
    newsym(x, y);
    return visible;
}
async function zapEngraving(x, y, source, state) {
    const engraving = engravingAt(x, y, state.level);
    if (!engraving || engraving.engr_type === HEADSTONE)
        return;
    switch (source.otyp) {
        case WAN_POLYMORPH:
        case SPE_POLYMORPH: {
            deleteEngravingAt(x, y, state.level);
            const { text, pristine } = randomEngraving();
            makeEngravingAt(x, y, text, pristine, state.moves, 0);
            break;
        }
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
        case WAN_MAKE_INVISIBLE:
            deleteEngravingAt(x, y, state.level);
            break;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY:
            relocateEngraving(engraving, state);
            break;
        case SPE_STONE_TO_FLESH:
            if (engraving.engr_type !== ENGRAVE)
                break;
            await pline(heroIsHallucinating(state)
                ? 'The floor runs like butter!' : 'The edges on the floor get smoother.');
            wipeEngravingAt(x, y, d(2, 4), true, state.level);
            break;
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            wipeEngravingAt(x, y, d(2, 4), true, state.level);
            break;
    }
}
// C engrave.c:rloc_engr(). Engravings need an ordinary, unoccupied floor.
function relocateEngraving(engraving, state) {
    for (let tries = 200; tries > 0; tries--) {
        const x = 2 + rn2(COLNO - 3), y = rn2(ROWNO);
        if (engravingAt(x, y, state.level) || !goodPosition(x, y, null, { state }))
            continue;
        engraving.x = x;
        engraving.y = y;
        newsym(x, y);
        return;
    }
}
async function zapDrawbridge(x, y, source, state) {
    const originalType = state.level.requireAt(x, y).typ;
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge)
        return false;
    switch (source.otyp) {
        case WAN_OPENING:
        case SPE_KNOCK:
            if (originalType === DBWALL) {
                const visible = cansee(x, y) || cansee(bridge.x, bridge.y);
                await openDrawbridge(bridge.x, bridge.y, state);
                return visible;
            }
            break;
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK: {
            const observed = (cansee(x, y) || cansee(bridge.x, bridge.y))
                && bridge.location.typ === DRAWBRIDGE_DOWN;
            await closeDrawbridge(bridge.x, bridge.y, state);
            return observed;
        }
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            if (originalType !== DRAWBRIDGE_UP) {
                await destroyDrawbridge(bridge.x, bridge.y, state);
                return true;
            }
            break;
    }
    return false;
}
function sameGlyph(left, right) {
    if (left === right)
        return true;
    if (!left || !right || left.kind !== right.kind)
        return false;
    switch (left.kind) {
        case 'terrain': return right.kind === 'terrain' && left.terrainName === right.terrainName;
        case 'object': return right.kind === 'object' && left.otyp === right.otyp;
        case 'monster': return right.kind === 'monster' && left.mnum === right.mnum;
        case 'trap': return right.kind === 'trap' && left.trapType === right.trapType;
        case 'effect':
        case 'engraving':
        case 'invisible':
        case 'nothing':
        case 'unexplored':
        case 'warning':
            return glyphCharacter(left) === glyphCharacter(right);
    }
}
async function probeTerrain(x, y, trap, learned, state) {
    const location = state.level.requireAt(x, y);
    const oldType = location.lastseentyp, oldGlyph = glyphAt(x, y, state);
    showMapSpot(x, y, { state });
    learned ||= oldType !== location.lastseentyp || !sameGlyph(oldGlyph, glyphAt(x, y, state));
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    if (surface === SDOOR) {
        revealSecretDoor(x, y);
        vision_note_blocker_change(x, y);
        newsym(x, y);
        if (cansee(x, y)) {
            await pline('Probing reveals a secret door.');
            learned = true;
        }
        else if (Is_rogue_level(state.u.uz))
            await pline('You feel a draft.');
    }
    else if (surface === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        newsym(x, y);
        await pline('Probing exposes a secret corridor.');
        learned = true;
    }
    else if ((surface === ICE || IS_FURNITURE(surface)) && (state.u.dz ?? 0) > 0) {
        await forceDescribeDecor({ state, probing: true });
        learned = true;
    }
    if (trap) {
        const seen = trap.tseen, hallucinating = heroIsHallucinating(state);
        trap.tseen = 1;
        newsym(x, y);
        if (!seen || hallucinating) {
            const name = trapName(trap.ttyp, { state });
            const definite = hallucinating ? !rn2(4)
                : trap.ttyp === VIBRATING_SQUARE && Invocation_lev(state.u.uz, state);
            await pline(`You find ${definite ? `the ${name}!` : `${withIndefiniteArticle(name)}.`}`);
            learned = !hallucinating;
        }
    }
    return learned;
}
function glyphCharacter(glyph) {
    return glyph && 'ch' in glyph && typeof glyph.ch === 'string' ? glyph.ch : undefined;
}
//# sourceMappingURL=wand_terrain_magic.js.map