// Monster state saved in bones levels.
// C refs: bones.c:savebones()/getbones().
import { setMonsterGivenName } from './monster_given_name.js';
import { DEFUNCT_MONSTER, DELPHI, Is_oracle_level, RLOC_NONE } from './const.js';
import { sanitizeBonesName } from './bones_name.js';
import { game, requireGameLevel } from './gstate.js';
import { isRoom } from './map_types.js';
import { findMonsterNearPosition } from './mklev.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { propagateMonsterSpecies } from './monster_population.js';
import { MONSTER_NAME, MONSTER_SOUND, SPECIAL_PM } from './monster_data.js';
import { hasPermanentIntrinsicProperty } from './properties.js';
import { races, roles } from './roles.js';
import { roomForRoomno } from './room.js';
import { relocateMonsterTo } from './teleport.js';
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const PM_VLAD = MONSTER_NAME.indexOf('Vlad the Impaler');
const PM_ORACLE = MONSTER_NAME.indexOf('Oracle');
const MS_LEADER = 36;
const MS_NEMESIS = 37;
export async function prepareBonesMonstersForSave() {
    const level = requireGameLevel();
    for (const monster of [...level.monsters]) {
        const sound = MONSTER_SOUND[monster.mnum];
        if (monster.iswiz || monster.mnum === PM_MEDUSA
            || sound === MS_LEADER || sound === MS_NEMESIS
            || monster.mnum === PM_VLAD || monster.cham === PM_VLAD
            || monster.mnum === PM_ORACLE && !await fixupOracle(monster))
            await removeMonsterFromGame(monster);
    }
    purgeDeadMonsters(level);
}
async function fixupOracle(oracle) {
    if (!Is_oracle_level(game.u.uz))
        return false;
    const level = requireGameLevel();
    oracle.mpeaceful = 1;
    const currentRoom = () => roomForRoomno(level, level.at(oracle.mx, oracle.my)?.roomno ?? 0);
    if (currentRoom()?.rtype === DELPHI)
        return true;
    const chamber = level.rooms.find(room => isRoom(room) && room.orig_rtype === DELPHI);
    if (!isRoom(chamber))
        return true;
    if (currentRoom() !== chamber) {
        const x = Math.trunc((chamber.lx + chamber.hx) / 2);
        const y = Math.trunc((chamber.ly + chamber.hy) / 2);
        const destination = findMonsterNearPosition(oracle.mnum, x, y);
        if (destination)
            await relocateMonsterTo(oracle, destination.x, destination.y, { flags: RLOC_NONE });
    }
    if (currentRoom() === chamber)
        chamber.rtype = DELPHI;
    return true;
}
function sanitizeMonsterName(monster) {
    const name = monster?.mextra?.mgivenname
        || monster?.mgivenname
        || monster?.name;
    if (!name)
        return;
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
]);
function roleIndex(state) {
    const index = roles.findIndex(role => role.key === state.urole?.key);
    return index < 0 ? 0 : index;
}
function raceIndex(state) {
    const index = races.findIndex(race => race.noun === state.urace?.noun);
    return index < 0 ? 0 : index;
}
export function giveHeroResistancesToMonster(monster, state = game) {
    let inherited = 0;
    for (const [property, bit] of HERO_RESISTANCES) {
        if (hasPermanentIntrinsicProperty(property, state))
            inherited |= bit;
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
    setMonsterGivenName(monster, name);
    monster.m_lev = state.u?.ulevel || 1;
    monster.mhp = monster.mhpmax = state.u?.uhpmax || 1;
    monster.female = !!state.flags?.female;
    monster.msleeping = 1;
    monster.mextra ??= {};
    monster.mextra.ebones = ebones;
    return monster;
}
export async function restoreBonesMonsters(level, state) {
    // C restmonchn() admits the complete chain before getbones() starts
    // purging it. Inventory drops during purge must not affect admission
    // of an actor later in that chain.
    for (const monster of level?.monsters || []) {
        // C priest.c:restpriest(): bones belong to the receiving level.
        if (monster.ispriest && state.u.uz?.dlevel) {
            const shrine = monster.epri ?? monster.mextra?.epri;
            if (!shrine)
                throw new Error(`Bones priest ${monster.m_id} has no shrine record.`);
            shrine.shrlevel = { ...state.u.uz };
        }
        const species = typeof monster.cham === 'number' && Number.isInteger(monster.cham) && monster.cham >= 0
            ? monster.cham : monster.mnum;
        if (!propagateMonsterSpecies(species, true, true, state))
            monster.mhpmax = DEFUNCT_MONSTER;
    }
    for (const monster of [...(level?.monsters || [])]) {
        sanitizeMonsterName(monster);
        if (monster.mhpmax !== DEFUNCT_MONSTER)
            continue;
        await removeMonsterFromGame(monster);
    }
}
//# sourceMappingURL=bones_monster.js.map