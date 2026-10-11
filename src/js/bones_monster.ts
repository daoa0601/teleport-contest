// Monster state saved in bones levels.
// C refs: bones.c:savebones()/getbones().

import { setMonsterGivenName } from './monster_given_name.js';
import { DEFUNCT_MONSTER } from './const.js';
import { sanitizeBonesName } from './bones_name.js';
import { game } from './gstate.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { propagateMonsterSpecies } from './monster_population.js';
import { SPECIAL_PM } from './monster_data.js';
import { hasIntrinsicProperty } from './properties.js';
import { races, roles } from './roles.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { PropertyName } from './property_types.js';

function sanitizeMonsterName(monster: Monster): void {
    const name = monster?.mextra?.mgivenname
        || monster?.mgivenname
        || monster?.name;
    if (!name) return;
    const sanitized = sanitizeBonesName(name);
    setMonsterGivenName(monster, sanitized);
}

const HERO_RESISTANCES = Object.freeze([
    ['fireResistance', 0x01],
    ['coldResistance', 0x02],
    ['sleepResistance', 0x04],
    ['disintegrationResistance', 0x08],
    ['shockResistance', 0x10],
    ['poisonResistance', 0x20],
    ['acidResistance', 0x40],
    ['stoneResistance', 0x80],
] satisfies Array<readonly [PropertyName, number]>);

function roleIndex(state: GameState): number {
    const index = roles.findIndex(role => role.key === state.urole?.key);
    return index < 0 ? 0 : index;
}

function raceIndex(state: GameState): number {
    const index = races.findIndex(race =>
        race.noun === state.urace?.noun);
    return index < 0 ? 0 : index;
}

export function giveHeroResistancesToMonster(monster: Monster, state: GameState = game): number {
    let inherited = 0;
    for (const [property, bit] of HERO_RESISTANCES) {
        if (hasIntrinsicProperty(property, null, state)) inherited |= bit;
    }
    monster.mintrinsics = (monster.mintrinsics ?? 0) | inherited;
    return inherited;
}

export function completeBonesMonster<T extends Monster>(monster: T, state: GameState = game): T {
    const name = state.plname || 'player';
    const finalRole = roleIndex(state);
    const finalRace = raceIndex(state);
    const ebones = {
        parentmid: monster.m_id,
        role: finalRole,
        race: finalRace,
        oldalign: state.u?.ualign?.type ?? 0,
        deathlevel: state.u?.ulevel ?? 0,
        luck: state.u?.uluck ?? 0,
        mnum: SPECIAL_PM + 1 + finalRole,
        female: !!state.flags?.female,
        demigod: !!state.u?.uevent?.udemigod,
        crowned: !!state.u?.uevent?.uhand_of_elbereth,
    };

    setMonsterGivenName(monster, name);
    monster.m_lev = state.u?.ulevel || 1;
    monster.mhp = monster.mhpmax = state.u?.uhpmax || 1;
    monster.female = !!state.flags?.female;
    monster.msleeping = 1;
    monster.mextra ??= {};
    monster.mextra.ebones = ebones;
    return monster;
}

export async function restoreBonesMonsters(level: Pick<GameMap, 'monsters'>, state: GameState): Promise<void> {
    // C restmonchn() admits the complete chain before getbones() starts
    // purging it. Inventory drops during purge must not affect admission
    // of an actor later in that chain.
    for (const monster of level?.monsters || []) {
        const species = typeof monster.cham === 'number' && Number.isInteger(monster.cham) && monster.cham >= 0
            ? monster.cham : monster.mnum;
        if (!propagateMonsterSpecies(species, true, true, state))
            monster.mhpmax = DEFUNCT_MONSTER;
    }
    for (const monster of [...(level?.monsters || [])]) {
        sanitizeMonsterName(monster);
        if (monster.mhpmax !== DEFUNCT_MONSTER) continue;
        await removeMonsterFromGame(monster);
    }
}
