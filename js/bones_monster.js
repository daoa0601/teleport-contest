// Monster state saved in bones levels.
// C refs: bones.c:savebones()/getbones().

import { G_EXTINCT, G_GENOD } from './const.js';
import { sanitizeBonesName } from './bones_name.js';
import { game } from './gstate.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { SPECIAL_PM } from './monster_data.js';
import { hasIntrinsicProperty } from './properties.js';
import { races, roles } from './roles.js';

function sanitizeMonsterName(monster) {
    const name = monster?.mextra?.mgivenname
        || monster?.mgivenname
        || monster?.name;
    if (!name) return;
    const sanitized = sanitizeBonesName(name);
    monster.name = sanitized;
    monster.mgivenname = sanitized;
    monster.mextra = {
        ...(monster.mextra || {}),
        mgivenname: sanitized,
    };
}

function speciesIsGone(monster, state) {
    const flags = state.mvitals?.[monster.mnum]?.mvflags ?? 0;
    return !!(flags & (G_EXTINCT | G_GENOD));
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
]);

function roleIndex(state) {
    const index = roles.findIndex(role => role.key === state.urole?.key);
    return index < 0 ? 0 : index;
}

function raceIndex(state) {
    const index = races.findIndex(race =>
        race.noun === (state.urace?.noun || state.urace?.name));
    return index < 0 ? 0 : index;
}

export function giveHeroResistancesToMonster(monster, state = game) {
    let inherited = 0;
    for (const [property, bit] of HERO_RESISTANCES) {
        if (hasIntrinsicProperty(property, null, state)) inherited |= bit;
    }
    monster.mintrinsics = (monster.mintrinsics ?? 0) | inherited;
    return inherited;
}

export function completeBonesMonster(monster, state = game) {
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

    monster.name = name;
    monster.mgivenname = name;
    monster.m_lev = state.u?.ulevel || 1;
    monster.mhp = monster.mhpmax = state.u?.uhpmax || 1;
    monster.female = !!state.flags?.female;
    monster.msleeping = 1;
    monster.mextra = {
        ...(monster.mextra || {}),
        mgivenname: name,
        ebones,
    };
    return monster;
}

export function restoreBonesMonsters(level, state) {
    for (const monster of [...(level?.monsters || [])]) {
        sanitizeMonsterName(monster);
        if (!speciesIsGone(monster, state)) continue;
        removeMonsterFromGame(monster, {
            preserveGlyph: true,
        });
    }
}
