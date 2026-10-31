// C mhitm.c:engulf_target()/gulpmm(). Engulfing changes map occupancy
// temporarily while both actors remain in the level's monster chain.
import { DOOR, D_CLOSED, D_LOCKED, IRONBARS, IS_OBSTRUCTED, IS_TREE, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, MM_IGNOREWATER, } from './const.js';
import { canSpotMonster, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { resolveMonsterLiquid } from './mon.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, monsterDigests, monsterEnfolds, monsterIsVampireShifter, monsterIsWhirly, requireMonsterData, } from './monster_data.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import { snuffMonsterInventoryLights } from './monster_inventory_light.js';
import { monsterAtPosition, placeMonsterOnMap, removeMonsterFromMapAt } from './monster_location.js';
import { monsterName, namelessMonsterName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { d, rn2, rnd } from './rng.js';
import { goodPosition } from './teleport_rules.js';
import { cansee } from './vision.js';
const M1_WALLWALK = 0x08;
const MZ_HUGE = 4;
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));
export async function resolveMonsterCombatEngulf(attacker, defender, attack, { state = game, visible, resolveDamage, publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, }) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const miss = {
        damage: 0, nativeResult: M_ATTK_MISS, heroDied: false, skipBrainDrain: false,
    };
    if (!monsterCanEngulfMonster(attacker, defender, state))
        return miss;
    if (visible) {
        const verb = monsterDigests(attacker) ? 'swallows' : monsterEnfolds(attacker) ? 'encloses' : 'engulfs';
        await publish(`${monsterName(attacker, { state, capitalized: true })} ${verb} ${monsterName(defender, { state })}.`);
    }
    if (!FLAMING_SPECIES.has(attacker.mnum))
        await snuffMonsterInventoryLights(defender, state, publish);
    if (monsterIsVampireShifter(defender)) {
        const change = await changeMonsterForm(defender, defender.cham, state, { publish });
        if (change?.heroDied)
            return { ...miss, heroDied: true };
        if (change) {
            if (visible) {
                await publish(`${monsterName(attacker, { state, capitalized: true })} expels ${canSpotMonster(defender) ? 'it' : 'something'}.`);
                if (canSpotMonster(defender)) {
                    await publish(`It turns into ${namelessMonsterName(defender, {
                        state, article: 'a', suppressIt: true, suppressInvisible: true,
                    })}.`);
                }
            }
            return { ...miss, nativeResult: M_ATTK_HIT };
        }
    }
    const origin = { x: attacker.mx, y: attacker.my };
    const target = { x: defender.mx, y: defender.my };
    const previousEngulf = state._monsterEngulf;
    const previousSwallower = state._monsterSwallower;
    removeMonsterFromMapAt(target.x, target.y, state);
    removeMonsterFromMapAt(origin.x, origin.y, state);
    state._monsterEngulf = { attacker, defender, defenderExposed: false };
    try {
        await placeMonsterOnMap(attacker, target.x, target.y, state);
        await newsym(origin.x, origin.y);
        await newsym(target.x, target.y);
        state._monsterSwallower = attacker;
        let result;
        try {
            result = await resolveDamage(attacker, defender, attack);
        }
        finally {
            state._monsterSwallower = previousSwallower;
        }
        const attackerDied = !!(result.nativeResult & M_ATTK_AGR_DIED);
        const defenderDied = !!(result.nativeResult & M_ATTK_DEF_DIED);
        if (result.heroDied || attackerDied && defenderDied)
            return result;
        if (defenderDied) {
            const destination = goodPosition(target.x, target.y, { kind: 'monster', monster: attacker }, {
                state, gpflags: MM_IGNOREWATER, random,
            }) ? target : origin;
            const alreadyPlaced = monsterAtPosition(state.level, destination.x, destination.y) === attacker;
            if (!alreadyPlaced)
                await placeMonsterOnMap(attacker, destination.x, destination.y, state);
            state._monsterEngulf = previousEngulf;
            if (destination !== target)
                await newsym(target.x, target.y);
            if (!alreadyPlaced)
                await newsym(destination.x, destination.y);
            const liquid = await resolveMonsterLiquid(attacker, state, {
                announce: publish, random, rollOne, rollDice,
                finishDeath: (monster, death) => finishMonsterLiquidDeath(monster, {
                    ...death, rollDice, publish,
                }),
            });
            if (liquid?.heroDied || state.program_state.gameover)
                return { ...result, heroDied: true };
            if (attacker.mhp > 0 && state.level.traps.some(trap => trap.tx === destination.x && trap.ty === destination.y)) {
                const trap = await triggerImmediateMonsterTrap(attacker, state, { random, rollOne, rollDice });
                await finishImmediateMonsterTrap(trap, state, { publish, random });
            }
            return { ...result,
                nativeResult: result.nativeResult | (attacker.mhp <= 0 ? M_ATTK_AGR_DIED : 0),
                heroDied: !!state.program_state.gameover };
        }
        if (attackerDied) {
            await placeMonsterOnMap(defender, target.x, target.y, state);
            state._monsterEngulf = previousEngulf;
            await newsym(target.x, target.y);
        }
        else {
            if (cansee(target.x, target.y)) {
                const verb = monsterDigests(attacker) ? 'regurgitated' : monsterEnfolds(attacker) ? 'released' : 'expelled';
                await publish(`${monsterName(defender, { state, capitalized: true })} is ${verb}!`);
            }
            removeMonsterFromMapAt(target.x, target.y, state);
            await placeMonsterOnMap(attacker, origin.x, origin.y, state);
            await placeMonsterOnMap(defender, target.x, target.y, state);
            state._monsterEngulf = previousEngulf;
            await newsym(origin.x, origin.y);
            await newsym(target.x, target.y);
        }
        return result;
    }
    finally {
        state._monsterSwallower = previousSwallower;
        state._monsterEngulf = previousEngulf;
    }
}
export function monsterCanEngulfMonster(attacker, defender, state) {
    const defenderSize = requireMonsterData(MONSTER_SIZE, defender.mnum);
    if (defenderSize >= MZ_HUGE
        || (requireMonsterData(MONSTER_SIZE, attacker.mnum) < defenderSize && !monsterIsWhirly(attacker))
        || attacker.mtrapped || defender.mtrapped)
        return false;
    if (!(requireMonsterData(MONSTER_FLAGS1, defender.mnum) & M1_WALLWALK)
        && engulfSquareBlocked(state.level.at(defender.mx, defender.my), attacker))
        return false;
    return !!(requireMonsterData(MONSTER_FLAGS1, attacker.mnum) & M1_WALLWALK)
        || !engulfSquareBlocked(state.level.at(attacker.mx, attacker.my), defender);
}
function engulfSquareBlocked(square, other) {
    return !square || IS_OBSTRUCTED(square.typ) || IS_TREE(square.typ)
        || (square.typ === DOOR && !!(square.doormask & (D_CLOSED | D_LOCKED)))
        || (square.typ === IRONBARS && !monsterIsWhirly(other));
}
//# sourceMappingURL=monster_combat_engulf.js.map