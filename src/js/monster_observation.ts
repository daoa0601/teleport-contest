// C mon.c:see_monster_closeup(). Photographs record a species once.
import { isok, M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE } from './const.js';
import { canSeeMonster, canSenseMonster } from './display.js';
import { addExperience, checkExperienceLevel, monsterExperience } from './exper.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { findMonsterArmorClass } from './monworn.js';
import { heroIsAmphibious } from './hero_species.js';
import { game, requireLiveGame } from './gstate.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import type { GameState } from './game_state.js';
import type { Monster, MonsterVital } from './monster_types.js';

interface ObservationOptions {
    photo?: boolean;
    onHead?: boolean;
    state?: GameState;
}

// C mon.c:see_nearby_monsters(). Only a completed timed action records
// nearby species; ordinary map redraws do not add to the close-up count.
export async function seeNearbyMonsters(state: GameState = game): Promise<void> {
    const hero = state.u;
    if (!state.level || heroIsHallucinating(state)
        || heroIsBlind(state) && !hero.telepathy) return;
    for (let x = hero.ux - 1; x <= hero.ux + 1; x++) {
        for (let y = hero.uy - 1; y <= hero.uy + 1; y++) {
            if (!isok(x, y)) continue;
            const monster: Monster | null = monsterAtPosition(state.level, x, y);
            if (!monster) continue;
            const species = M_AP_TYPE(monster) === M_AP_MONSTER
                ? monster.mappearance : monster.mnum;
            if (species === undefined) throw new Error(`Monster ${monster.m_id} has no disguise species`);
            if (state.mvitals?.[species]?.seen_close) continue;
            if (canSeeMonster(monster) || monster.mundetected && canSenseMonster(monster)) {
                state.bhitpos.x = x;
                state.bhitpos.y = y;
                state.notonhead = x !== monster.mx || y !== monster.my;
                await seeMonsterCloseup(monster, {
                    onHead: !state.notonhead, state,
                });
            }
        }
    }
}

export async function seeMonsterCloseup(
    monster: Monster,
    { photo = false, onHead = true, state = game }: ObservationOptions = {},
): Promise<void> {
    requireLiveGame(state);
    if (heroIsHallucinating(state) || heroIsBlind(state) && !state.u.telepathy) return;
    const disguise = M_AP_TYPE(monster);
    const actualSpecies = !onHead && monster.mnum === MONSTER_NAME.indexOf('long worm')
        ? MONSTER_NAME.indexOf('long worm tail') : monster.mnum;
    const species = disguise === M_AP_MONSTER ? monster.mappearance : actualSpecies;
    if (species === undefined) throw new Error(`Monster ${monster.m_id} has no disguise species`);
    const seenSpecies = disguise === M_AP_MONSTER && !canSenseMonster(monster)
        ? species : actualSpecies;
    const seen = speciesVitals(state, seenSpecies);
    const lifelist = state.context.lifelist || (state.context.lifelist = {});
    if (!seen.seen_close) {
        seen.seen_close = 1;
        lifelist.total_seen_upclose = (lifelist.total_seen_upclose || 0) + 1;
    }
    if (!photo || monster.minvis || monster.mundetected
        || ![M_AP_NOTHING, M_AP_MONSTER].includes(disguise)) return;
    const vital = speciesVitals(state, species);
    if (vital.photographed) return;
    vital.photographed = 1;
    lifelist.total_photographed = (lifelist.total_photographed || 0) + 1;
    if (state.urole?.key === 'tourist' && species === monster.mnum
        && (monster.m_id !== state.context.startingpet_mid
            || species !== state.context.startingpet_typ)) {
        addExperience(monsterExperience(monster, {
            killCount: 0, armorClass: findMonsterArmorClass(monster),
            amphibious: heroIsAmphibious(state),
        }), 0, state);
        await checkExperienceLevel();
    }
}

function speciesVitals(state: GameState, species: number): MonsterVital {
    const vitals = state.mvitals || (state.mvitals = []);
    return vitals[species] ?? (vitals[species] = { mvflags: 0, born: 0, died: 0 });
}
