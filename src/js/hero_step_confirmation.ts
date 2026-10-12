// C hack.c:avoid_trap_andor_region()/u_locomotion() and
// trap.c:immune_to_trap()/into_vs_onto(), for hero movement.
import {
    BEAR_TRAP, HOLE, In_endgame, In_sokoban, Is_earthlevel, LANDMINE,
    LEVEL_TELEP, MAGIC_PORTAL, PARANOID_CONFIRM, PARANOID_TRAP, PIT,
    ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD,
    TELEP_TRAP, TRAPDOOR, TRAP_EXPLANATIONS, TRAPNUM, VIBRATING_SQUARE,
    WEB, W_QUIVER, W_SWAPWEP, is_hole, is_pit,
} from './const.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import type { GameState } from './game_state.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly,
} from './monster_data.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { OBJECT_MATERIAL } from './object_data.js';
import { paranoidQuery } from './query.js';
import { visibleRegionAt } from './regions.js';
import { rnd } from './rng.js';
import { stopRun } from './runmode.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';

// The caller first checks test_move(TEST_MOVE), without opening doors,
// pushing boulders, or escaping the hero's current trap.
export async function confirmHeroStep(x: number, y: number, state: GameState = game): Promise<boolean> {
    requirePlayingGame(state);
    const bits = state.flags.paranoia_bits ?? 0;
    const stunned = state.u.stunned || (state.u.stunnedTurns ?? 0) > 0;
    const confused = (state.u.confusionTurns ?? 0) > 0;
    if (!(bits & PARANOID_TRAP) || stunned || confused
        || (state.context.nopick && !state.context.run)) return true;
    const hallucinating = heroIsHallucinating(state);
    const locomotion = state.u.levitating ? 'float' : state.u.flying ? 'fly'
        : monsterLocomotion(heroSpecies(state), 'step');
    const confirm = !!(bits & PARANOID_CONFIRM);
    if (!heroIsBlind(state) && !hallucinating) {
        const entered = visibleRegionAt(state, x, y);
        const exited = visibleRegionAt(state, state.u.ux, state.u.uy);
        if (entered && (!exited || (entered.damage > 0 && exited.damage === 0))) {
            const verb = locomotion.charAt(0).toUpperCase() + locomotion.slice(1);
            if (!await paranoidQuery(confirm,
                `${verb} into that ${entered.damage > 0 ? 'poison gas' : 'vapor'} cloud?`, bits)) {
                cancelStep(state);
                return false;
            }
        }
    }
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap?.tseen || (!hallucinating && trapIsClearlyHarmless(trap.ttyp, state))) return true;
    const type = hallucinating ? rnd(TRAPNUM - 1) : trap.ttyp;
    const into = [BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL, WEB].includes(type);
    const name = TRAP_EXPLANATIONS[type];
    if (!name) throw new Error(`Cannot name trap type ${type} for movement confirmation`);
    if (await paranoidQuery(confirm, `Really ${locomotion} ${into ? 'into' : 'onto'} that ${name}?`, bits))
        return true;
    cancelStep(state);
    return false;
}

function cancelStep(state: GameState): void {
    stopRun(state);
    endVoluntaryMultiTurn(state);
    state.context.move = 0;
}

// Hidden resistance still deserves a warning. Only native CLEARLY_IMMUNE
// results suppress confirmation; this decision never reveals equipment.
function trapIsClearlyHarmless(type: number, state: GameState): boolean {
    const species = heroSpecies(state);
    const body = { mnum: species };
    const flags = MONSTER_FLAGS1[species] ?? 0;
    switch (type) {
        case BEAR_TRAP:
            if ((MONSTER_SIZE[species] ?? 2) <= 1 || monsterIsAmorphous(body)
                || monsterIsWhirly(body) || monsterIsUnsolid(body)) return true;
            return avoidsGroundTraps(type, state);
        case SQKY_BOARD:
        case LANDMINE:
        case ROLLING_BOULDER_TRAP:
        case HOLE:
        case TRAPDOOR:
        case PIT:
        case SPIKED_PIT:
            return avoidsGroundTraps(type, state);
        case SLP_GAS_TRAP:
            return !!(flags & 0x00000400); // breathless body
        case LEVEL_TELEP:
        case TELEP_TRAP:
            // Native mon_has_amulet(&youmonst) checks its empty monster
            // inventory, not the hero's carried Amulet.
            return In_endgame(state.u.uz);
        case WEB:
            return monsterIsAmorphous(body) || monsterIsWhirly(body) || monsterIsUnsolid(body)
                || ['cave spider', 'giant spider', 'gelatinous cube', 'fire vortex',
                    'flaming sphere', 'fire elemental', 'salamander'].includes(MONSTER_NAME[species] ?? '');
        case RUST_TRAP:
            if (MONSTER_NAME[species] === 'iron golem') return false;
            return !state.inventory.some(object => OBJECT_MATERIAL[object.otyp] === 11
                && !!object.owornmask && !(object.owornmask & W_QUIVER)
                && (!(object.owornmask & W_SWAPWEP) || state.u.twoweap));
        case VIBRATING_SQUARE:
            return true;
        default:
            return false;
    }
}

function avoidsGroundTraps(type: number, state: GameState): boolean {
    if (state.level?.flags.sokoban_rules && (is_pit(type) || is_hole(type))) return false;
    if (In_sokoban(state.u.uz) && type === ROLLING_BOULDER_TRAP) return true;
    const species = heroSpecies(state);
    const flags = MONSTER_FLAGS1[species] ?? 0;
    const symbol = MONSTER_SYMBOL[species];
    const ceiling = !In_endgame(state.u.uz) || Is_earthlevel(state.u.uz);
    return !!(state.u.levitating || state.u.flying || (flags & 1)
        || symbol === 5 || symbol === 25 || ((flags & 0x10) && ceiling));
}
