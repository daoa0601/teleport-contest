// Orc-town's stolen goods and raiding gang.
// C mkmaze.c:stolen_booty(), migr_booty_item(), shiny_orc_stuff(), migrate_orc();
// do_name.c:rndorcname()/christen_orc(), dokick.c:deliver_obj_to_mon().
import { MIGR_LEFTOVERS, MIGR_RANDOM, MIGR_TO_SPECIES, MM_NONAME, NON_PM } from './const.js';
import { addFruit } from './fruit.js';
import { game, requirePlayingGame } from './gstate.js';
import { makemonAt, mkobj, mksobj } from './mklev.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { setMonsterMalign } from './monster_alignment.js';
import { migrateMonsterOffLevel } from './monster_migration.js';
import { CORPSE, EGG, GOLD_PIECE, LEATHER_GLOVES, LEMBAS_WAFER, LONG_SWORD, OBJECT_NAMES, OBJECT_PROB, ROCK, SKELETON_KEY, SLIME_MOLD, TALLOW_CANDLE, TIN, TRIPE_RATION, WAX_CANDLE, } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { objectWeight } from './weight.js';
import { randomTypeByDescription } from './wish_lookup.js';
import { deallocateObject } from './object_delete.js';
const C_RATION = OBJECT_NAMES.indexOf('C-ration');
const K_RATION = OBJECT_NAMES.indexOf('K-ration');
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
const M2_ORC = 0x80;
const DELIVER_SPECIES = 0x21fe; // undead, were, human, elf, dwarf, gnome, orc, demon, giant
const FOOD_CLASS = 7, GEM_CLASS = 13, RING_CLASS = 4;
const PM_ORC = MONSTER_NAME.indexOf('orc');
const PM_ORC_SHAMAN = MONSTER_NAME.indexOf('orc shaman');
const PM_ORC_CAPTAIN = MONSTER_NAME.indexOf('orc-captain');
export async function createOrcRaid() {
    requirePlayingGame(game);
    const state = game;
    const gang = randomOrcName();
    for (let count = rnd(4); count > 0; count--)
        await createStolenItem(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, gang, state);
    for (let count = rnd(3); count > 0; count--)
        await createStolenItem(SKELETON_KEY, gang, state);
    await createStolenItem(LEATHER_GLOVES + rn2(GAUNTLETS_OF_DEXTERITY - LEATHER_GLOVES + 1), gang, state);
    for (let count = rnd(10); count > 0; count--) {
        const type = TRIPE_RATION + rn2(TIN - TRIPE_RATION + 1);
        if (type !== LEMBAS_WAFER && ((OBJECT_PROB[type] ?? 0) > 0 || type === C_RATION || type === K_RATION)
            && type !== CORPSE && type !== EGG && type !== TIN)
            await createStolenItem(type, gang, state);
    }
    await createStolenItem(rn2(2) ? LONG_SWORD : SILVER_SABER, gang, state);
    const captain = await makemonAt(PM_ORC_CAPTAIN, 0, 0, MM_NONAME);
    if (captain) {
        setMonsterGivenName(captain, capitalized(gang));
        captain.mpeaceful = 0;
        setMonsterMalign(captain, state);
        await giveShinyLoot(captain, state);
        await sendRaiderToLowerMines(captain, true, state);
    }
    // C fmon is newest-first; the runtime monster array stores births in order.
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0)
            continue;
        if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ORC && !monster.name && rn2(10)) {
            if (monster.mnum !== PM_ORC_CAPTAIN)
                nameOrc(monster, gang);
        }
    }
    for (let count = rn2(10) + 5; count > 0; count--) {
        const monster = await makemonAt(PM_ORC + rn2(PM_ORC_SHAMAN - PM_ORC + 1), 0, 0, MM_NONAME);
        if (!monster)
            continue;
        await giveShinyLoot(monster, state);
        await sendRaiderToLowerMines(monster, false, state);
    }
}
function randomOrcName() {
    const vowels = ['a', 'ai', 'og', 'u'];
    const consonants = ['gor', 'gris', 'un', 'bane', 'ruk', 'oth', 'ul', 'z', 'thos', 'akh', 'hai'];
    const count = rn2(2) + 3;
    let vowelFirst = rn2(2);
    let name = '';
    for (let index = 0; index < count; index++) {
        vowelFirst = 1 - vowelFirst;
        if (index > 0 && rn2(30) === 0)
            name += '-';
        const syllables = vowelFirst ? vowels : consonants;
        const syllable = syllables[rn2(syllables.length)];
        if (syllable === undefined)
            throw new Error('Orc name selection exceeded its syllables.');
        name += syllable;
    }
    return name;
}
function capitalized(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
function nameOrc(monster, gang, suffix = '') {
    const name = capitalized(randomOrcName());
    setMonsterGivenName(monster, gang === null ? name + suffix : `${name} of ${capitalized(gang)}`);
}
async function createStolenItem(type, gang, state) {
    const object = await mksobj(type, true, false);
    object.where = 'migrating';
    object.owornmask = MIGR_TO_SPECIES;
    object.migration = { source: { dnum: 0, dlevel: 0 }, destination: { dnum: 0, dlevel: 0 },
        arrival: MIGR_TO_SPECIES, speciesFlags: M2_ORC };
    object.oextra ??= {};
    object.oextra.oname = gang;
    state.migratingObjects ??= [];
    state.migratingObjects.unshift(object);
    if (object.oclass === FOOD_CLASS) {
        if (type === SLIME_MOLD)
            object.spe = addFruit(rn2(2) ? 'dwarven root' : 'paddle cactus', { state });
        object.quan += rn2(3);
        object.owt = objectWeight(object);
    }
}
async function giveShinyLoot(monster, state) {
    const captain = monster.mnum === PM_ORC_CAPTAIN;
    const goldChance = captain ? 600 : 300;
    if (rn2(1000) < goldChance) {
        const gold = await mksobj(GOLD_PIECE, true, false);
        gold.quan = 1 + rnd(goldChance);
        gold.owt = objectWeight(gold);
        await addObjectToMonsterInventory(monster, gold, state);
    }
    if (rn2(1000) < goldChance / 4) {
        const gem = await mkobj(GEM_CLASS, false);
        if (gem.otyp !== ROCK)
            await addObjectToMonsterInventory(monster, gem, state);
        else
            deallocateObject(gem, state);
    }
    if (captain || rn2(8) === 0) {
        const type = randomTypeByDescription('shiny', RING_CLASS, 0, state);
        if (type !== null)
            await addObjectToMonsterInventory(monster, await mksobj(type, true, false), state);
    }
}
async function sendRaiderToLowerMines(monster, leader, state) {
    const current = state.u.uz;
    const bottom = state.dungeons[current.dnum]?.num_dunlevs;
    if (bottom === undefined)
        throw new Error('Orc raid requires the current Mines branch.');
    let destination;
    if (leader) {
        destination = bottom - Number(rn2(40) === 0);
        monster.migflags = (monster.migflags ?? 0) | MIGR_LEFTOVERS;
    }
    else {
        destination = Math.min(bottom, Math.max(current.dlevel + 1, current.dlevel + rn2(bottom - current.dlevel + 1)));
        monster.migflags = (monster.migflags ?? 0) & ~MIGR_LEFTOVERS;
    }
    await migrateMonsterOffLevel(monster, state, { dst: { dnum: current.dnum, dlevel: destination } }, { kind: 'level-migration', mode: MIGR_RANDOM });
}
export async function deliverOrcRaidLoot(monster, state, all = false) {
    for (const object of [...(state.migratingObjects ?? [])]) {
        const migration = object.migration;
        if (!migration || !(migration.arrival & MIGR_TO_SPECIES)
            || migration.speciesFlags === undefined || migration.speciesFlags === NON_PM
            || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & DELIVER_SPECIES) !== migration.speciesFlags)
            continue;
        const index = state.migratingObjects?.indexOf(object) ?? -1;
        if (index >= 0)
            state.migratingObjects?.splice(index, 1);
        object.where = 'free';
        object.owornmask = 0;
        object.ox = object.oy = 0;
        if ((migration.speciesFlags & M2_ORC) && object.oextra?.oname) {
            if (!monster.name) {
                const inMines = state.u.uz?.dnum === state.mines_dnum;
                if (inMines || rn2(2) === 0)
                    nameOrc(monster, inMines ? object.oextra.oname : null, ' the Fence');
            }
            delete object.oextra.oname;
        }
        object.corpsenm = NON_PM;
        delete object.migration;
        await addObjectToMonsterInventory(monster, object, state);
        if (!all)
            break;
    }
}
//# sourceMappingURL=orc_raid.js.map