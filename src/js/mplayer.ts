// C mplayer.c: player opponents, their equipment, and developer names.
import { artifactById, createRandomArtifact } from './artifacts.js';
import { COLNO, ROWNO, In_endgame, MM_NOMSG, P_SPEAR, RLOC_ERR, RLOC_NOMSG } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { makemonAt, mkobj, mksobj, rndClass } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MONSTER_FLAGS2, MONSTER_NAME, monsterIsPlayerMonster } from './monster_data.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { addCreatedObjectToMonsterInventory } from './monster_inventory.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterRank } from './monster_name.js';
import { giveMonsterStartingGold, giveMonsterStartingObject } from './monster_starting_inventory.js';
import type { Monster } from './monster_types.js';
import { monsterMightThrowWeapon } from './monster_weapon.js';
import { initializeMonsterArmor } from './monworn.js';
import { randomOffensiveMonsterItem, randomDefensiveMonsterItem, randomMiscMonsterItem } from './muse.js';
import {
    BATTLE_AXE, BLACK_DRAGON_SCALE_MAIL, BULLWHIP, CHAIN_MAIL,
    CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE, CLUB, DILITHIUM_CRYSTAL,
    ELVEN_DAGGER, ELVEN_LEATHER_HELM, ELVEN_SHIELD, FAKE_AMULET_OF_YENDOR,
    GAUNTLETS_OF_POWER, GRAY_DRAGON_SCALE_MAIL,
    JADE, KATANA, LEATHER_GLOVES,
    LEVITATION_BOOTS, LOADSTONE, LONG_SWORD, LUCKSTONE, MACE,
    OBJECT_MERGE, OBJECT_SUBTYPE, OBJECT_NAMES, ORCISH_DAGGER,
    QUARTERSTAFF, ROBE, SCALPEL, SHIELD_OF_REFLECTION, SHORT_SWORD,
    SILVER_DRAGON_SCALE_MAIL, SPEAR, TWO_HANDED_SWORD,
    UNICORN_HORN, WAR_HAMMER, YELLOW_DRAGON_SCALE_MAIL,
} from './object_data.js';
import { blessObjectState, curseObject } from './object_state.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { randomMonsterRelocation } from './teleport.js';
import { goodPosition } from './teleport_rules.js';
import { objectWeight } from './weight.js';

const STRANGE_OBJECT = 0;
const ATHAME = OBJECT_NAMES.indexOf('athame');
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const HELM_OF_BRILLIANCE = OBJECT_NAMES.indexOf('helm of brilliance');
const HELM_OF_TELEPATHY = OBJECT_NAMES.indexOf('helm of telepathy');
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
const PLATE_MAIL = OBJECT_NAMES.indexOf('plate mail');
const SHURIKEN = OBJECT_NAMES.indexOf('shuriken');

const PM_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');
const PM_WIZARD = MONSTER_NAME.indexOf('wizard');

export async function createPlayerMonsters(count: number, special: boolean): Promise<void> {
    while (count-- > 0) {
        const species = rn1(PM_WIZARD - PM_ARCHEOLOGIST + 1, PM_ARCHEOLOGIST);
        let attempts = 0, x: number, y: number;
        do {
            x = rn1(COLNO - 4, 2);
            y = rnd(ROWNO - 2);
        } while (!goodPosition(x, y, { kind: 'species', mnum: species }) && attempts++ <= 50);
        if (attempts > 50) return;
        await createPlayerMonster(species, x, y, special);
    }
}

export async function createPlayerMonster(
    species: number, x: number, y: number, special: boolean,
): Promise<Monster | null> {
    if (!monsterIsPlayerMonster(species)) return null;
    const occupant = monsterAtPosition(requireGameLevel(), x, y);
    if (occupant) await randomMonsterRelocation(occupant, { flags: RLOC_ERR | RLOC_NOMSG });
    special &&= In_endgame(game.u.uz);
    const monster = await makemonAt(species, x, y, special ? MM_NOMSG : 0);
    if (!monster) return null;
    monster.m_lev = special ? rn1(16, 15) : rnd(16);
    monster.mhp = monster.mhpmax = d(monster.m_lev, 10) + (special ? 30 + rnd(30) : 30);
    if (special) {
        namePlayerMonster(monster);
        await giveMonsterStartingObject(monster, FAKE_AMULET_OF_YENDOR);
    }
    monster.mpeaceful = 0;
    setMonsterMalign(monster);
    const equipment = selectPlayerEquipment(species);
    await givePlayerWeapon(monster, equipment.weapon, special);
    if (special) await equipSpecialPlayer(monster, equipment);
    for (let count = rnd(3); count > 0; count--)
        await giveMonsterStartingObject(monster, randomOffensiveMonsterItem(monster));
    for (let count = rnd(3); count > 0; count--)
        await giveMonsterStartingObject(monster, randomDefensiveMonsterItem(monster));
    for (let count = rnd(3); count > 0; count--)
        await giveMonsterStartingObject(monster, randomMiscMonsterItem(monster));
    return monster;
}

interface PlayerEquipment {
    weapon: number;
    armor: number;
    cloak: number;
    helm: number;
    shield: number;
}

function selectPlayerEquipment(species: number): PlayerEquipment {
    let weapon = !rn2(2) ? LONG_SWORD : rndClass(SPEAR, BULLWHIP);
    let armor = rndClass(GRAY_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALE_MAIL);
    let cloak = !rn2(8) ? STRANGE_OBJECT : rndClass(OILSKIN_CLOAK, CLOAK_OF_DISPLACEMENT);
    let helm = !rn2(8) ? STRANGE_OBJECT : rndClass(ELVEN_LEATHER_HELM, HELM_OF_TELEPATHY);
    let shield = !rn2(8) ? STRANGE_OBJECT : rndClass(ELVEN_SHIELD, SHIELD_OF_REFLECTION);
    switch (MONSTER_NAME[species] ?? '') {
    case 'archeologist':
        if (rn2(2)) weapon = BULLWHIP;
        break;
    case 'barbarian':
        if (rn2(2)) {
            weapon = rn2(2) ? TWO_HANDED_SWORD : BATTLE_AXE;
            shield = STRANGE_OBJECT;
        }
        if (rn2(2)) armor = rndClass(PLATE_MAIL, CHAIN_MAIL);
        if (helm === HELM_OF_BRILLIANCE) helm = STRANGE_OBJECT;
        break;
    case 'cave dweller':
        if (rn2(4)) weapon = MACE;
        else if (rn2(2)) weapon = CLUB;
        if (helm === HELM_OF_BRILLIANCE) helm = STRANGE_OBJECT;
        break;
    case 'healer':
        if (rn2(4)) weapon = QUARTERSTAFF;
        else if (rn2(2)) weapon = rn2(2) ? UNICORN_HORN : SCALPEL;
        if (rn2(4)) helm = rn2(2) ? HELM_OF_BRILLIANCE : HELM_OF_TELEPATHY;
        if (rn2(2)) shield = STRANGE_OBJECT;
        break;
    case 'knight':
        if (rn2(4)) weapon = LONG_SWORD;
        if (rn2(2)) armor = rndClass(PLATE_MAIL, CHAIN_MAIL);
        break;
    case 'monk':
        weapon = !rn2(3) ? SHURIKEN : STRANGE_OBJECT;
        armor = STRANGE_OBJECT;
        cloak = ROBE;
        if (rn2(2)) shield = STRANGE_OBJECT;
        break;
    case 'cleric':
        if (rn2(2)) weapon = MACE;
        if (rn2(2)) armor = rndClass(PLATE_MAIL, CHAIN_MAIL);
        if (rn2(4)) cloak = ROBE;
        if (rn2(4)) helm = rn2(2) ? HELM_OF_BRILLIANCE : HELM_OF_TELEPATHY;
        if (rn2(2)) shield = STRANGE_OBJECT;
        break;
    case 'ranger':
        if (rn2(2)) weapon = ELVEN_DAGGER;
        break;
    case 'rogue':
        if (rn2(2)) weapon = rn2(2) ? SHORT_SWORD : ORCISH_DAGGER;
        break;
    case 'samurai':
        if (rn2(2)) weapon = KATANA;
        break;
    case 'tourist':
        break;
    case 'valkyrie':
        if (rn2(2)) weapon = WAR_HAMMER;
        if (rn2(2)) armor = rndClass(PLATE_MAIL, CHAIN_MAIL);
        break;
    case 'wizard':
        if (rn2(4)) weapon = rn2(2) ? QUARTERSTAFF : ATHAME;
        if (rn2(2)) {
            armor = rn2(2) ? BLACK_DRAGON_SCALE_MAIL : SILVER_DRAGON_SCALE_MAIL;
            cloak = CLOAK_OF_MAGIC_RESISTANCE;
        }
        if (rn2(4)) helm = HELM_OF_BRILLIANCE;
        shield = STRANGE_OBJECT;
        break;
    default:
        throw new Error(`Player equipment requires a player species; received ${species}`);
    }
    return { weapon, armor, cloak, helm, shield };
}

async function givePlayerWeapon(monster: Monster, type: number, special: boolean): Promise<void> {
    if (type === STRANGE_OBJECT) return;
    const object = await mksobj(type, true, false);
    object.oeroded = object.oeroded2 = 0;
    object.spe = special ? rn1(5, 4) : rn2(4);
    if (!rn2(3)) object.oerodeproof = true;
    else if (!rn2(2)) object.greased = true;
    if (special && rn2(2)) createRandomArtifact(object, { maximumValue: 99, adjustEnchantment: false });
    if (OBJECT_MERGE[object.otyp] && !object.oartifact && monsterMightThrowWeapon(object)) {
        object.quan += rn2(OBJECT_SUBTYPE[object.otyp] === P_SPEAR ? 4 : 8);
        object.quantity = object.quan;
    }
    object.owt = objectWeight(object);
    if (artifactById(object.oartifact)?.name === 'Magicbane') object.spe = rnd(4);
    await addCreatedObjectToMonsterInventory(monster, object);
}

async function equipSpecialPlayer(monster: Monster, equipment: PlayerEquipment): Promise<void> {
    if (!rn2(10)) await giveMonsterStartingObject(monster, rn2(3) ? LUCKSTONE : LOADSTONE);
    await givePlayerArmor(monster, equipment.armor);
    await givePlayerArmor(monster, equipment.cloak);
    await givePlayerArmor(monster, equipment.helm);
    await givePlayerArmor(monster, equipment.shield);
    if (equipment.weapon === WAR_HAMMER) await givePlayerArmor(monster, GAUNTLETS_OF_POWER);
    else if (rn2(8)) await givePlayerArmor(monster, rndClass(LEATHER_GLOVES, GAUNTLETS_OF_DEXTERITY));
    if (rn2(8)) await givePlayerArmor(monster, rndClass(LOW_BOOTS, LEVITATION_BOOTS));
    await initializeMonsterArmor(monster);
    for (let count = rn2(3) ? rn2(3) : rn2(16); count > 0; count--)
        await giveMonsterStartingObject(monster, rndClass(DILITHIUM_CRYSTAL, JADE));
    await giveMonsterStartingGold(monster, rn2(1000));
    for (let count = rn2(10); count > 0; count--)
        await addCreatedObjectToMonsterInventory(monster, await mkobj(0, false));
}

async function givePlayerArmor(monster: Monster, type: number): Promise<void> {
    if (type === STRANGE_OBJECT) return;
    const object = await mksobj(type, false, false);
    object.oeroded = object.oeroded2 = 0;
    if (!rn2(3)) object.oerodeproof = true;
    if (!rn2(3)) await curseObject(object);
    if (!rn2(3)) blessObjectState(object);
    object.spe = rn2(10) ? (rn2(3) ? rn2(5) : rn1(4, 4)) : -rnd(3);
    await addCreatedObjectToMonsterInventory(monster, object);
}

const DEVELOPERS = [
    'Alex', 'Dave', 'Dean', 'Derek', 'Eric', 'Izchak', 'Janet', 'Jessie', 'Ken', 'Kevin',
    'Michael', 'Mike', 'Pasi', 'Pat', 'Patric', 'Paul', 'Sean', 'Steve', 'Timo', 'Warwick',
    'Bill', 'Eric', 'Keizo', 'Ken', 'Kevin', 'Michael', 'Mike', 'Paul', 'Stephen', 'Steve', 'Timo', 'Yitzhak',
    'Andy', 'Gregg', 'Janne', 'Keni', 'Mike', 'Olaf', 'Richard',
    'Andy', 'Chris', 'Dean', 'Jon', 'Jonathan', 'Kevin', 'Wang',
    'Eric', 'Marvin', 'Warwick', 'Alex', 'Dion', 'Michael', 'Helge', 'Ron', 'Timo', 'Joshua', 'Pat', '',
];

function namePlayerMonster(monster: Monster): void {
    const femaleKind = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x20000);
    const developer = unusedDeveloperName();
    const name = developer === null ? (femaleKind ? 'Eve' : 'Adam')
        : femaleKind && developer !== 'Janet' ? (rn2(2) ? 'Maud' : 'Eve') : developer;
    monster.female = femaleKind || name === 'Janet';
    setMonsterGivenName(monster, `${name} the ${monsterRank(monster)}`);
}

function unusedDeveloperName(): string | null {
    for (let attempts = 0; attempts < 100; attempts++) {
        const name = DEVELOPERS[rn2(DEVELOPERS.length)];
        if (name === undefined) throw new RangeError('Developer name is outside its table');
        const used = game.level?.monsters.some(monster => monsterIsPlayerMonster(monster.mnum)
            && (monster.mgivenname ?? monster.mextra?.mgivenname ?? '').startsWith(name));
        if (!used) return name;
    }
    return null;
}
