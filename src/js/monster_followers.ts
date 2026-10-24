// C dog.c:keepdogs(), keep_mon_accessible(), and mondata.c:levl_follower().
import type { Monster, MonsterLevel } from './monster_types.js';
import type { GameState } from './game_state.js';
import { MIGR_EXACT_XY, STRAT_WAITFORU } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { MONSTER_NAME, monsterIsHumanoid } from './monster_data.js';
import { questMonsterFlags2 } from './role_monsters.js';
import { dropSpecialMonsterObjects } from './monster_drop.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { detachMonsterFromLevel } from './monster_level_departure.js';
import { migrateMonsterOffLevel, prepareMonsterDeparture } from './monster_migration.js';
import { monsterName, possessiveName } from './monster_name.js';
import { finishMonsterEating } from './monster_eating.js';
import { tryMonsterTrapEscape } from './monster_trap_escape.js';
import { AMULET_OF_YENDOR } from './object_data.js';

const M2_STALK = 0x01000000;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');

// The caller skips this entire transaction when iflags.nofollowers is set.
// Returned monsters are detached from the old level in native mydogs order.
export async function collectLevelFollowers(state: GameState = game, petsOnly = false): Promise<Monster[]> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const level = state.level;
    const followers: Monster[] = [];
    // Births append in the port; C fmon links each new monster at the head.
    for (const monster of level.monsters.slice().reverse()) {
        if (monster.mhp <= 0) continue;
        if (petsOnly) {
            if (!monster.mtame) continue;
            monster.mtrapped = 0;
            finishMonsterEating(monster, state);
            monster.msleeping = monster.mfrozen = 0;
            monster.mcanmove = 1;
        }
        const follows = (nearHero(monster, state) && levelFollower(monster, state)
            || state.u.uhave.amulet && monster.iswiz)
            && (!(monster.msleeping || !monster.mcanmove) || monster === state.u.usteed)
            && !((monster.mstrategy ?? 0) & STRAT_WAITFORU);
        if (follows) {
            if (monster.mtrapped) {
                await tryMonsterTrapEscape(monster, state, {
                    describeMonster: target => monsterName(target, { capitalized: true, state }),
                });
            }
            if (monster === state.u.usteed) {
                monster.mtrapped = 0;
                monster.meating = 0;
                await dropSpecialMonsterObjects(monster, state);
            } else if (await staysBehind(monster, state)) {
                continue;
            }
            prepareMonsterDeparture(monster, state);
            await detachMonsterFromLevel(monster, state);
            monster.mx = monster.my = 0;
            monster.mlstmv = state.moves;
            // C relmon() prepends each transferred monster to mydogs.
            followers.unshift(monster);
        } else if (keepAccessible(monster, state.u.uz)) {
            await migrateMonsterOffLevel(monster, state, { dst: { ...state.u.uz } }, {
                kind: 'level-migration', mode: MIGR_EXACT_XY,
            });
        } else if (monster.mleashed) {
            const name = monsterName(monster, { capitalized: true, state });
            await plineWithContinuation(`${possessiveName(name)} leash goes slack.`);
            releaseMonsterLeash(monster, state);
        }
    }
    return followers;
}

function nearHero(monster: Monster, state: GameState): boolean {
    const dx = monster.mx - state.u.ux;
    const dy = monster.my - state.u.uy;
    const distance = dx * dx + dy * dy;
    return distance < 3 && !(distance === 2 && monster.mnum === PM_GRID_BUG);
}

function levelFollower(monster: Monster, state: GameState): boolean {
    if (monster === state.u.usteed) return true;
    if (monster.iswiz && carriesAmulet(monster)) return false;
    if (monster.mtame || monster.iswiz || monster.isshk && monster.eshk?.following)
        return true;
    return !!(questMonsterFlags2(monster.mnum, state) & M2_STALK)
        && (!monster.mflee || !!state.u.uhave?.amulet);
}

function carriesAmulet(monster: Monster): boolean {
    // C wizard.c:mon_has_amulet() examines minvent, not container contents.
    return (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR);
}

async function staysBehind(monster: Monster, state: GameState): Promise<boolean> {
    let message: string;
    if (monster.meating || monster.mtrapped) {
        message = `is still ${monster.meating ? 'eating' : 'trapped'}.`;
    } else if (carriesAmulet(monster)) {
        message = 'seems very disoriented for a moment.';
    } else {
        return false;
    }
    if (canSeeMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, {
            capitalized: true, state,
        })} ${message}`);
    }
    if (monster.mleashed) {
        // This is a species/sex pronoun, independent of visibility or hallucination.
        const whose = monsterIsHumanoid(monster.mnum)
            ? monster.female ? 'Her' : 'His' : 'Its';
        await plineWithContinuation(`${whose} leash suddenly comes loose.`);
        releaseMonsterLeash(monster, state);
    }
    return true;
}

function keepAccessible(monster: Monster, current: MonsterLevel): boolean {
    if (monster.iswiz) return true;
    const homes = [
        monster.isshk ? monster.eshk?.shoplevel : null,
        monster.ispriest ? (monster.epri ?? monster.mextra?.epri)?.shrlevel : null,
        monster.isgd ? monster._egd?.gdlevel : null,
    ];
    for (const home of homes) {
        if (home === undefined)
            throw new Error(`Monster ${monster.m_id} has no home level for its resident role.`);
        if (home !== null && (home.dnum !== current.dnum || home.dlevel !== current.dlevel))
            return true;
    }
    return false;
}
