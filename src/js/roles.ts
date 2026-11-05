// role.c — the character tables and the whole role/race/gender/alignment
// selection mechanic, in role.c source order: roles[], races[], aligns[],
// genders[], then the ports of role.c's functions.
//
// The complete quest/skill tables are still being ported, but startup uses
// real role records rather than a display-only name.  Attribute arrays keep
// NetHack's C order: Str, Int, Wis, Dex, Con, Cha.

import { MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_ANY, PICK_ONE } from './const.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { rn2 } from './rng.js';
import { NO_COLOR } from './terminal.js';
import { withIndefiniteArticle } from './objnam.js';
import { rawPrint } from './pline.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow,
    tty_end_menu, tty_select_menu, tty_start_menu,
} from './tty_menu.js';
import type { ParsedCharacterName } from './character_name.js';
import type { TtyMenuWindow } from './tty_menu.js';

export type RoleKey =
    | 'archeologist' | 'barbarian' | 'caveman' | 'healer' | 'knight'
    | 'monk' | 'priest' | 'ranger' | 'rogue' | 'samurai' | 'tourist'
    | 'valkyrie' | 'wizard';
export type RaceName = 'human' | 'elf' | 'dwarf' | 'gnome' | 'orc';
export type AlignmentName = 'lawful' | 'neutral' | 'chaotic';
export type AlignmentValue = 1 | 0 | -1;
export type GenderName = 'male' | 'female';
export type GenderValue = 0 | 1;

export type AttributeValues = [
    strength: number, intelligence: number, wisdom: number,
    dexterity: number, constitution: number, charisma: number,
];

export interface Advancement {
    infix: number;
    inrnd: number;
    lofix: number;
    lornd: number;
    hifix: number;
    hirnd: number;
}

export interface GenderedName {
    m: string;
    f: string;
}

export interface Spellcasting {
    base: number;
    healing: number;
    shield: number;
    armor: number;
    stat: 'intelligence' | 'wisdom';
    special: string;
    specialBonus: number;
}

export interface Role {
    key: RoleKey;
    filecode: string;
    name: GenderedName;
    mnum: number;
    title: GenderedName[];
    rank?: GenderedName;
    gods?: Record<AlignmentName, string>;
    goddessAlignments?: AlignmentName[];
    attrbase: AttributeValues;
    attrdist: AttributeValues;
    hpadv: Advancement;
    enadv: Advancement;
    xlev: number;
    initrecord: number;
    petnum: number;
    intrinsicFast?: boolean;
    homebase?: string;
    intermediate?: string;
    ldrnum: number;
    guardnum: number;
    neminum?: number;
    guardianName?: string;
    guardianPlural?: string;
    artifactName: string;
    enemy1num: number | null;
    enemy1sym: number;
    enemy2num: number;
    enemy2sym: number;
    greeting: string;
    goodbye: string;
    spellcasting: Spellcasting;
}

export interface Race {
    name: RaceName;
    noun: string;
    adj: string;
    filecode: string;
    raceIndex: number;
    selfmask: number;
    lovemask: number;
    hatemask: number;
    mnum: number;
    mummynum: number;
    zombienum: number;
    attrmin: AttributeValues;
    attrmax: AttributeValues;
    hpadv: Advancement;
    enadv: Advancement;
}

export interface Alignment {
    name: AlignmentName;
    value: AlignmentValue;
}

export interface Gender {
    name: GenderName;
    value: GenderValue;
}

const roleRecords: Omit<Role, 'spellcasting'>[] = [
    { key: 'archeologist', filecode: 'Arc', name: { m: 'Archeologist', f: 'Archeologist' }, mnum: 0,
      title: [
          { m: 'Digger', f: 'Digger' },
          { m: 'Field Worker', f: 'Field Worker' },
          { m: 'Investigator', f: 'Investigator' },
          { m: 'Exhumer', f: 'Exhumer' },
          { m: 'Excavator', f: 'Excavator' },
          { m: 'Spelunker', f: 'Spelunker' },
          { m: 'Speleologist', f: 'Speleologist' },
          { m: 'Collector', f: 'Collector' },
          { m: 'Curator', f: 'Curator' },
      ],
      gods: { lawful: 'Quetzalcoatl', neutral: 'Camaxtli', chaotic: 'Huhetotl' },
      attrbase: [7, 10, 10, 7, 7, 7],
      attrdist: [20, 20, 20, 10, 20, 10],
      hpadv: {
          infix: 11, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 14,
      initrecord: 10,
      petnum: -1,
      homebase: 'the College of Archeology',
      intermediate: 'the Tomb of the Toltec Kings',
      ldrnum: 344,
      guardnum: 369,
      neminum: 357,
      guardianName: 'student',
      guardianPlural: 'students',
      artifactName: 'the Orb of Detection',
      enemy1num: null,
      enemy1sym: 45,
      enemy2num: 192,
      enemy2sym: 39,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'barbarian', filecode: 'Bar', name: { m: 'Barbarian', f: 'Barbarian' }, mnum: 1,
      title: [
          { m: 'Plunderer', f: 'Plunderess' },
          { m: 'Pillager', f: 'Pillager' },
          { m: 'Bandit', f: 'Bandit' },
          { m: 'Brigand', f: 'Brigand' },
          { m: 'Raider', f: 'Raider' },
          { m: 'Reaver', f: 'Reaver' },
          { m: 'Slayer', f: 'Slayer' },
          { m: 'Chieftain', f: 'Chieftainess' },
          { m: 'Conqueror', f: 'Conqueress' },
      ],
      gods: { lawful: 'Mitra', neutral: 'Crom', chaotic: 'Set' },
      attrbase: [16, 7, 7, 15, 16, 6],
      attrdist: [30, 6, 7, 20, 30, 7],
      hpadv: {
          infix: 14, inrnd: 0, lofix: 0, lornd: 10, hifix: 2, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 10,
      initrecord: 10,
      petnum: -1,
      homebase: 'the Camp of the Duali Tribe',
      intermediate: 'the Duali Oasis',
      ldrnum: 345,
      guardnum: 370,
      neminum: 358,
      guardianName: 'chieftain',
      guardianPlural: 'chieftains',
      artifactName: 'the Heart of Ahriman',
      enemy1num: 203,
      enemy1sym: 41,
      enemy2num: 220,
      enemy2sym: 46,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'caveman', filecode: 'Cav', name: { m: 'Caveman', f: 'Cavewoman' }, mnum: 2,
      title: [
          { m: 'Troglodyte', f: 'Troglodyte' },
          { m: 'Aborigine', f: 'Aborigine' },
          { m: 'Wanderer', f: 'Wanderer' },
          { m: 'Vagrant', f: 'Vagrant' },
          { m: 'Wayfarer', f: 'Wayfarer' },
          { m: 'Roamer', f: 'Roamer' },
          { m: 'Nomad', f: 'Nomad' },
          { m: 'Rover', f: 'Rover' },
          { m: 'Pioneer', f: 'Pioneer' },
      ],
      gods: { lawful: 'Anu', neutral: 'Ishtar', chaotic: 'Anshar' },
      goddessAlignments: ['neutral'],
      attrbase: [10, 7, 7, 7, 8, 6],
      attrdist: [30, 6, 7, 20, 30, 7],
      hpadv: {
          infix: 14, inrnd: 0, lofix: 0, lornd: 8, hifix: 2, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 10,
      initrecord: 0,
      petnum: 16,
      ldrnum: 346,
      guardnum: 371,
      neminum: 359,
      homebase: 'the Caves of the Ancestors',
      intermediate: "the Dragon's Lair",
      artifactName: 'the Sceptre of Might',
      enemy1num: 45,
      enemy1sym: 8,
      enemy2num: 171,
      enemy2sym: 34,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'healer', filecode: 'Hea', name: { m: 'Healer', f: 'Healer' }, mnum: 3,
      title: [
          { m: 'Rhizotomist', f: 'Rhizotomist' },
          { m: 'Empiric', f: 'Empiric' },
          { m: 'Embalmer', f: 'Embalmer' },
          { m: 'Dresser', f: 'Dresser' },
          { m: 'Medicus ossium', f: 'Medica ossium' },
          { m: 'Herbalist', f: 'Herbalist' },
          { m: 'Magister', f: 'Magistra' },
          { m: 'Physician', f: 'Physician' },
          { m: 'Chirurgeon', f: 'Chirurgeon' },
      ],
      gods: { lawful: 'Athena', neutral: 'Hermes', chaotic: 'Poseidon' },
      goddessAlignments: ['lawful'],
      attrbase: [7, 7, 13, 7, 11, 16],
      attrdist: [15, 20, 20, 15, 25, 5],
      hpadv: {
          infix: 11, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 2,
      },
      xlev: 20,
      initrecord: 10,
      petnum: -1,
      ldrnum: 347,
      guardnum: 372,
      neminum: 360,
      homebase: 'the Temple of Epidaurus',
      intermediate: 'the Temple of Coeus',
      artifactName: 'the Staff of Aesculapius',
      enemy1num: 89,
      enemy1sym: 18,
      enemy2num: 215,
      enemy2sym: 51,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'knight', filecode: 'Kni', name: { m: 'Knight', f: 'Knight' }, mnum: 4,
      title: [
          { m: 'Gallant', f: 'Gallant' },
          { m: 'Esquire', f: 'Esquire' },
          { m: 'Bachelor', f: 'Bachelor' },
          { m: 'Sergeant', f: 'Sergeant' },
          { m: 'Knight', f: 'Knight' },
          { m: 'Banneret', f: 'Banneret' },
          { m: 'Chevalier', f: 'Chevaliere' },
          { m: 'Seignieur', f: 'Dame' },
          { m: 'Paladin', f: 'Paladin' },
      ],
      gods: { lawful: 'Lugh', neutral: 'Brigit', chaotic: 'Manannan Mac Lir' },
      goddessAlignments: ['neutral'],
      attrbase: [13, 7, 14, 8, 10, 17],
      attrdist: [30, 15, 15, 10, 20, 10],
      hpadv: {
          infix: 14, inrnd: 0, lofix: 0, lornd: 8, hifix: 2, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 2,
      },
      xlev: 10,
      initrecord: 10,
      petnum: 100,
      homebase: 'Camelot Castle',
      intermediate: 'the Isle of Glass',
      ldrnum: 348,
      guardnum: 373,
      neminum: 361,
      guardianName: 'page',
      guardianPlural: 'pages',
      artifactName: 'the Magic Mirror of Merlin',
      enemy1num: 54,
      enemy1sym: 9,
      enemy2num: 58,
      enemy2sym: 10,
      greeting: 'Salutations', goodbye: 'Fare thee well' },
    { key: 'monk', filecode: 'Mon', name: { m: 'Monk', f: 'Monk' }, mnum: 5,
      title: [
          { m: 'Candidate', f: 'Candidate' },
          { m: 'Novice', f: 'Novice' },
          { m: 'Initiate', f: 'Initiate' },
          { m: 'Student of Stones', f: 'Student of Stones' },
          { m: 'Student of Waters', f: 'Student of Waters' },
          { m: 'Student of Metals', f: 'Student of Metals' },
          { m: 'Student of Winds', f: 'Student of Winds' },
          { m: 'Student of Fire', f: 'Student of Fire' },
          { m: 'Master', f: 'Master' },
      ],
      gods: {
          lawful: 'Shan Lai Ching', neutral: 'Chih Sung-tzu', chaotic: 'Huan Ti',
      },
      attrbase: [10, 7, 8, 8, 7, 7],
      attrdist: [25, 10, 20, 20, 15, 10],
      hpadv: {
          infix: 12, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 2, inrnd: 0, lofix: 0, lornd: 2, hifix: 0, hirnd: 2,
      },
      xlev: 10,
      intrinsicFast: true,
      initrecord: 10,
      petnum: -1,
      ldrnum: 349,
      guardnum: 374,
      neminum: 362,
      homebase: 'the Monastery of Chan-Sune',
      intermediate: 'the Monastery of the Earth-Lord',
      artifactName: 'the Eyes of the Overworld',
      enemy1num: 156,
      enemy1sym: 31,
      enemy2num: 232,
      enemy2sym: 50,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'priest', filecode: 'Pri', name: { m: 'Priest', f: 'Priestess' }, mnum: 6,
      title: [
          { m: 'Aspirant', f: 'Aspirant' },
          { m: 'Acolyte', f: 'Acolyte' },
          { m: 'Adept', f: 'Adept' },
          { m: 'Priest', f: 'Priestess' },
          { m: 'Curate', f: 'Curate' },
          { m: 'Canon', f: 'Canoness' },
          { m: 'Lama', f: 'Lama' },
          { m: 'Patriarch', f: 'Matriarch' },
          { m: 'High Priest', f: 'High Priestess' },
      ],
      attrbase: [7, 7, 10, 7, 7, 7],
      attrdist: [15, 10, 30, 15, 20, 10],
      hpadv: {
          infix: 12, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 4, inrnd: 0, lofix: 0, lornd: 2, hifix: 0, hirnd: 2,
      },
      xlev: 10,
      initrecord: 0,
      petnum: -1,
      homebase: 'the Great Temple',
      intermediate: 'the Temple of Nalzok',
      ldrnum: 350,
      guardnum: 375,
      neminum: 363,
      guardianName: 'Acolyte',
      guardianPlural: 'Acolytes',
      artifactName: 'the Mitre of Holiness',
      enemy1num: 244,
      enemy1sym: 52,
      enemy2num: 230,
      enemy2sym: 49,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'ranger', filecode: 'Ran', name: { m: 'Ranger', f: 'Ranger' }, mnum: 7,
      title: [
          { m: 'Tenderfoot', f: 'Tenderfoot' },
          { m: 'Lookout', f: 'Lookout' },
          { m: 'Trailblazer', f: 'Trailblazer' },
          { m: 'Reconnoiterer', f: 'Reconnoiteress' },
          { m: 'Scout', f: 'Scout' },
          { m: 'Arbalester', f: 'Arbalester' },
          { m: 'Archer', f: 'Archer' },
          { m: 'Sharpshooter', f: 'Sharpshooter' },
          { m: 'Marksman', f: 'Markswoman' },
      ],
      gods: { lawful: 'Mercury', neutral: 'Venus', chaotic: 'Mars' },
      goddessAlignments: ['neutral'],
      attrbase: [13, 13, 13, 9, 13, 7],
      attrdist: [30, 10, 10, 20, 20, 10],
      hpadv: {
          infix: 13, inrnd: 0, lofix: 0, lornd: 6, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 12,
      initrecord: 10,
      petnum: 16,
      ldrnum: 351,
      guardnum: 376,
      neminum: 364,
      homebase: "Orion's camp",
      intermediate: 'the cave of the wumpus',
      artifactName: 'the Longbow of Diana',
      enemy1num: 131,
      enemy1sym: 29,
      enemy2num: 97,
      enemy2sym: 19,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'rogue', filecode: 'Rog', name: { m: 'Rogue', f: 'Rogue' }, mnum: 8,
      title: [
          { m: 'Footpad', f: 'Footpad' },
          { m: 'Cutpurse', f: 'Cutpurse' },
          { m: 'Rogue', f: 'Rogue' },
          { m: 'Pilferer', f: 'Pilferer' },
          { m: 'Robber', f: 'Robber' },
          { m: 'Burglar', f: 'Burglar' },
          { m: 'Filcher', f: 'Filcher' },
          { m: 'Magsman', f: 'Magswoman' },
          { m: 'Thief', f: 'Thief' },
      ],
      gods: { lawful: 'Issek', neutral: 'Mog', chaotic: 'Kos' },
      attrbase: [7, 7, 7, 10, 7, 6],
      attrdist: [20, 10, 10, 30, 20, 10],
      hpadv: {
          infix: 10, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 11,
      initrecord: 10,
      petnum: -1,
      ldrnum: 352,
      guardnum: 377,
      neminum: 365,
      homebase: "the Thieves' Guild Hall",
      intermediate: "the Assassins' Guild Hall",
      artifactName: 'the Master Key of Thievery',
      enemy1num: 63,
      enemy1sym: 14,
      enemy2num: 202,
      enemy2sym: 40,
      greeting: 'Hello', goodbye: 'Goodbye' },
    { key: 'samurai', filecode: 'Sam', name: { m: 'Samurai', f: 'Samurai' }, mnum: 9,
      title: [
          { m: 'Hatamoto', f: 'Hatamoto' },
          { m: 'Ronin', f: 'Ronin' },
          { m: 'Ninja', f: 'Kunoichi' },
          { m: 'Joshu', f: 'Joshu' },
          { m: 'Ryoshu', f: 'Ryoshu' },
          { m: 'Kokushu', f: 'Kokushu' },
          { m: 'Daimyo', f: 'Daimyo' },
          { m: 'Kuge', f: 'Kuge' },
          { m: 'Shogun', f: 'Shogun' },
      ],
      gods: {
          lawful: 'Amaterasu Omikami', neutral: 'Raijin', chaotic: 'Susanowo',
      },
      goddessAlignments: ['lawful'],
      attrbase: [10, 8, 7, 10, 17, 6],
      attrdist: [30, 10, 8, 30, 14, 8],
      hpadv: {
          infix: 13, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 11,
      intrinsicFast: true,
      initrecord: 10,
      petnum: 16,
      ldrnum: 353,
      guardnum: 379,
      neminum: 366,
      homebase: 'the Castle of the Taro Clan',
      intermediate: "the Shogun's Castle",
      artifactName: 'the Tsurugi of Muramasa',
      enemy1num: 20,
      enemy1sym: 4,
      enemy2num: 153,
      enemy2sym: 31,
      greeting: 'Konnichi wa', goodbye: 'Sayonara' },
    { key: 'tourist', filecode: 'Tou', name: { m: 'Tourist', f: 'Tourist' }, mnum: 10,
      title: [
          { m: 'Rambler', f: 'Rambler' },
          { m: 'Sightseer', f: 'Sightseer' },
          { m: 'Excursionist', f: 'Excursionist' },
          { m: 'Peregrinator', f: 'Peregrinatrix' },
          { m: 'Traveler', f: 'Traveler' },
          { m: 'Journeyer', f: 'Journeyer' },
          { m: 'Voyager', f: 'Voyager' },
          { m: 'Explorer', f: 'Explorer' },
          { m: 'Adventurer', f: 'Adventurer' },
      ],
      gods: { lawful: 'Blind Io', neutral: 'The Lady', chaotic: 'Offler' },
      goddessAlignments: ['neutral'],
      attrbase: [7, 10, 6, 7, 7, 10],
      attrdist: [15, 10, 10, 15, 30, 20],
      hpadv: {
          infix: 8, inrnd: 0, lofix: 0, lornd: 8, hifix: 0, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 14,
      initrecord: 0,
      petnum: -1,
      ldrnum: 354,
      guardnum: 380,
      neminum: 352,
      homebase: 'Ankh-Morpork',
      intermediate: "the Thieves' Guild Hall",
      artifactName: 'the Platinum Yendorian Express Card',
      enemy1num: 96,
      enemy1sym: 19,
      enemy2num: 131,
      enemy2sym: 29,
      greeting: 'Aloha', goodbye: 'Aloha',
    },
    { key: 'valkyrie', filecode: 'Val', name: { m: 'Valkyrie', f: 'Valkyrie' }, mnum: 11,
      title: [
          { m: 'Stripling', f: 'Stripling' },
          { m: 'Skirmisher', f: 'Skirmisher' },
          { m: 'Fighter', f: 'Fighter' },
          { m: 'Man-at-arms', f: 'Woman-at-arms' },
          { m: 'Warrior', f: 'Warrior' },
          { m: 'Swashbuckler', f: 'Swashbuckler' },
          { m: 'Hero', f: 'Heroine' },
          { m: 'Champion', f: 'Champion' },
          { m: 'Lord', f: 'Lady' },
      ],
      gods: { lawful: 'Tyr', neutral: 'Odin', chaotic: 'Loki' },
      attrbase: [10, 7, 7, 7, 10, 7],
      attrdist: [30, 6, 7, 20, 30, 7],
      hpadv: {
          infix: 14, inrnd: 0, lofix: 0, lornd: 8, hifix: 2, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1,
      },
      xlev: 10,
      initrecord: 0,
      petnum: -1,
      ldrnum: 355,
      guardnum: 381,
      neminum: 367,
      homebase: 'the Shrine of Destiny',
      intermediate: 'the cave of Surtur',
      artifactName: 'the Orb of Fate',
      enemy1num: 3,
      enemy1sym: 1,
      enemy2num: 172,
      enemy2sym: 34,
      greeting: 'Velkommen', goodbye: 'Farvel' },
    { key: 'wizard', filecode: 'Wiz', name: { m: 'Wizard', f: 'Wizard' }, mnum: 12,
      title: [
          { m: 'Evoker', f: 'Evoker' },
          { m: 'Conjurer', f: 'Conjurer' },
          { m: 'Thaumaturge', f: 'Thaumaturge' },
          { m: 'Magician', f: 'Magician' },
          { m: 'Enchanter', f: 'Enchantress' },
          { m: 'Sorcerer', f: 'Sorceress' },
          { m: 'Necromancer', f: 'Necromancer' },
          { m: 'Wizard', f: 'Wizard' },
          { m: 'Mage', f: 'Mage' },
      ],
      gods: { lawful: 'Ptah', neutral: 'Thoth', chaotic: 'Anhur' },
      attrbase: [7, 10, 7, 7, 7, 7],
      attrdist: [10, 30, 10, 20, 20, 10],
      hpadv: {
          infix: 10, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 4, inrnd: 0, lofix: 0, lornd: 2, hifix: 0, hirnd: 3,
      },
      xlev: 12,
      initrecord: 0,
      petnum: 32,
      homebase: 'the Lonely Tower',
      intermediate: 'the Tower of Darkness',
      ldrnum: 356,
      guardnum: 382,
      neminum: 368,
      guardianName: 'apprentice',
      guardianPlural: 'apprentices',
      artifactName: 'the Eye of the Aethiopica',
      enemy1num: 129,
      enemy1sym: 28,
      enemy2num: 232,
      enemy2sym: 49,
      greeting: 'Hello', goodbye: 'Goodbye' },
];

// role.c orders Rogue before Ranger; the player-monster indices do the reverse.
// Native random role choices must use the role table's order.
export function nativeRoleAt(index: number): Role | undefined {
    const playerIndex = index === 7 ? 8 : index === 8 ? 7 : index;
    return roles.find(role => role.mnum === playerIndex);
}

// C ref: role.c roles[] spell statistics.  These fields feed the shared
// spell.c percent_success() calculation; they are live mechanics, not
// presentation defaults stored on individual spell records.
const ROLE_SPELLCASTING: Record<RoleKey, Spellcasting> = {
    archeologist: {
        base: 5, healing: 0, shield: 2, armor: 10,
        stat: 'intelligence', special: 'magic mapping', specialBonus: -4,
    },
    barbarian: {
        base: 14, healing: 0, shield: 0, armor: 8,
        stat: 'intelligence', special: 'haste self', specialBonus: -4,
    },
    caveman: {
        base: 12, healing: 0, shield: 1, armor: 8,
        stat: 'intelligence', special: 'dig', specialBonus: -4,
    },
    healer: {
        base: 3, healing: -3, shield: 2, armor: 10,
        stat: 'wisdom', special: 'cure sickness', specialBonus: -4,
    },
    knight: {
        base: 8, healing: -2, shield: 0, armor: 9,
        stat: 'wisdom', special: 'turn undead', specialBonus: -4,
    },
    monk: {
        base: 8, healing: -2, shield: 2, armor: 20,
        stat: 'wisdom', special: 'restore ability', specialBonus: -4,
    },
    priest: {
        base: 3, healing: -2, shield: 2, armor: 10,
        stat: 'wisdom', special: 'remove curse', specialBonus: -4,
    },
    ranger: {
        base: 9, healing: 2, shield: 1, armor: 10,
        stat: 'intelligence', special: 'invisibility', specialBonus: -4,
    },
    rogue: {
        base: 8, healing: 0, shield: 1, armor: 9,
        stat: 'intelligence', special: 'detect treasure', specialBonus: -4,
    },
    samurai: {
        base: 10, healing: 0, shield: 0, armor: 8,
        stat: 'intelligence', special: 'clairvoyance', specialBonus: -4,
    },
    tourist: {
        base: 5, healing: 1, shield: 2, armor: 10,
        stat: 'intelligence', special: 'charm monster', specialBonus: -4,
    },
    valkyrie: {
        base: 10, healing: -2, shield: 0, armor: 9,
        stat: 'wisdom', special: 'cone of cold', specialBonus: -4,
    },
    wizard: {
        base: 1, healing: 0, shield: 3, armor: 10,
        stat: 'intelligence', special: 'magic missile', specialBonus: -4,
    },
};

export const roles: Role[] = roleRecords.map(role => ({
    ...role,
    spellcasting: ROLE_SPELLCASTING[role.key],
}));

const M2_HUMAN = 0x00000008;
const M2_ELF = 0x00000010;
const M2_DWARF = 0x00000020;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;

export const races: Race[] = [
    { name: 'human', noun: 'human', adj: 'human', filecode: 'Hum',
      raceIndex: 0, selfmask: M2_HUMAN,
      lovemask: 0, hatemask: M2_GNOME | M2_ORC,
      mnum: 260, mummynum: 192, zombienum: 244,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [118, 18, 18, 18, 18, 18],
      hpadv: {
          infix: 2, inrnd: 0, lofix: 0, lornd: 2, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0,
      } },
    { name: 'elf', noun: 'elf', adj: 'elven', filecode: 'Elf',
      raceIndex: 1, selfmask: M2_ELF,
      lovemask: M2_ELF, hatemask: M2_ORC,
      mnum: 264, mummynum: 191, zombienum: 243,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [18, 20, 20, 18, 16, 18],
      hpadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 2, inrnd: 0, lofix: 3, lornd: 0, hifix: 3, hirnd: 0,
      } },
    { name: 'dwarf', noun: 'dwarf', adj: 'dwarven', filecode: 'Dwa',
      raceIndex: 2, selfmask: M2_DWARF,
      lovemask: M2_DWARF | M2_GNOME, hatemask: M2_ORC,
      mnum: 44, mummynum: 190, zombienum: 242,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [118, 16, 16, 20, 20, 16],
      hpadv: {
          infix: 4, inrnd: 0, lofix: 0, lornd: 3, hifix: 2, hirnd: 0,
      },
      enadv: {
          infix: 0, inrnd: 0, lofix: 0, lornd: 0, hifix: 0, hirnd: 0,
      } },
    { name: 'gnome', noun: 'gnome', adj: 'gnomish', filecode: 'Gno',
      raceIndex: 3, selfmask: M2_GNOME,
      lovemask: M2_DWARF | M2_GNOME, hatemask: M2_HUMAN,
      mnum: 165, mummynum: 188, zombienum: 240,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [68, 19, 18, 18, 18, 18],
      hpadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 0,
      },
      enadv: {
          infix: 2, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0,
      } },
    { name: 'orc', noun: 'orc', adj: 'orcish', filecode: 'Orc',
      raceIndex: 4, selfmask: M2_ORC,
      lovemask: 0, hatemask: M2_HUMAN | M2_ELF | M2_DWARF,
      mnum: 72, mummynum: 189, zombienum: 241,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [68, 16, 16, 18, 18, 16],
      hpadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 1, lornd: 0, hifix: 1, hirnd: 0,
      } },
];

export const aligns: Alignment[] = [
    { name: 'lawful', value: 1 },
    { name: 'neutral', value: 0 },
    { name: 'chaotic', value: -1 },
];

export const genders: Gender[] = [
    { name: 'male', value: 0 },
    { name: 'female', value: 1 },
];

// ── role.c function ports, in role.c source order ──

// C ref: role.c roles[] table order.  The JS role table keeps Ranger
// before Rogue for historical callers, while the C selection table
// deliberately keeps Rogue before Ranger; random character selection must
// use the latter order to preserve the PRNG-to-role mapping.
const CHARACTER_ROLE_ORDER: readonly RoleKey[] = [
    'archeologist', 'barbarian', 'caveman', 'healer', 'knight', 'monk',
    'priest', 'rogue', 'ranger', 'samurai', 'tourist', 'valkyrie', 'wizard',
];

export function nativeRoleChoices(): Role[] {
    return CHARACTER_ROLE_ORDER.flatMap(key => {
        const role = roles.find(candidate => candidate.key === key);
        return role ? [role] : [];
    });
}

// C ref: role.c roles[].allow and races[].allow masks, expressed as the
// race, gender, and alignment names each role and race permits.
interface RoleSelectionRules {
    races: readonly RaceName[];
    aligns: readonly AlignmentName[];
    genders?: readonly GenderName[];
}

export const ROLE_SELECTION_RULES: Record<RoleKey, RoleSelectionRules> = {
    archeologist: { races: ['human', 'dwarf', 'gnome'], aligns: ['lawful', 'neutral'] },
    barbarian: { races: ['human', 'orc'], aligns: ['neutral', 'chaotic'] },
    caveman: { races: ['human', 'dwarf', 'gnome'], aligns: ['lawful', 'neutral'] },
    healer: { races: ['human', 'gnome'], aligns: ['neutral'] },
    knight: { races: ['human'], aligns: ['lawful'] },
    monk: { races: ['human'], aligns: ['lawful', 'neutral', 'chaotic'] },
    priest: { races: ['human', 'elf'], aligns: ['lawful', 'neutral', 'chaotic'] },
    rogue: { races: ['human', 'orc'], aligns: ['chaotic'] },
    ranger: { races: ['human', 'elf', 'gnome', 'orc'], aligns: ['neutral', 'chaotic'] },
    samurai: { races: ['human'], aligns: ['lawful'] },
    tourist: { races: ['human'], aligns: ['neutral'] },
    valkyrie: { races: ['human', 'dwarf'], aligns: ['lawful', 'neutral'], genders: ['female'] },
    wizard: { races: ['human', 'elf', 'gnome', 'orc'], aligns: ['neutral', 'chaotic'] },
};

// C ref: role.c races[].allow & ROLE_ALIGNMASK.
export const RACE_SELECTION_RULES: Record<RaceName, { aligns: readonly AlignmentName[] }> = {
    human: { aligns: ['lawful', 'neutral', 'chaotic'] },
    elf: { aligns: ['chaotic'] },
    dwarf: { aligns: ['lawful'] },
    gnome: { aligns: ['neutral'] },
    orc: { aligns: ['chaotic'] },
};

export type RoleChoice = Role | null | undefined;
export type RaceChoice = Race | null | undefined;
export type GenderChoice = Gender | null | undefined;
export type AlignmentChoice = Alignment | null | undefined;

export interface CharacterChoices {
    role: RoleChoice;
    race: RaceChoice;
    gender: GenderChoice;
    alignment: AlignmentChoice;
}

export type CharacterFacet = 'role' | 'race' | 'gender' | 'alignment';

// C ref: role.c gr.rfilter — the role/race/gender/alignment masks the
// player filtered out of character selection.
export interface CharacterFilters {
    roles: Set<RoleKey>;
    races: Set<RaceName>;
    genders: Set<GenderName>;
    alignments: Set<AlignmentName>;
}

// C role.c:str2role(): resolve a role by case-insensitive prefix, in
// native table order.
export function str2role(name: unknown): Role | null | undefined {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    // str2role() resolves ambiguous prefixes in native table order,
    // where Rogue precedes Ranger.
    for (let index = 0; index < roles.length; index++) {
        const role = nativeRoleAt(index);
        if (role && (role.name.m.toLowerCase().startsWith(lc)
            || role.name.f.toLowerCase().startsWith(lc))) return role;
    }
    return undefined;
}

// C role.c:validrace(): the role's permitted-race mask and the race's
// alignment mask (roles[].allow & races[].allow) as table membership;
// IndexOkT bounds are the typed lookups.  ok_race() adds the filter
// masks and the any-candidate question; validrace() only checks the
// two tables.
export function validrace(role: RoleChoice, race: Race, alignment: AlignmentChoice): boolean {
    return (!role || ROLE_SELECTION_RULES[role.key].races.includes(race.name))
        && (!alignment || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}

// C role.c:str2race(): resolve a race by name or adjective prefix.
export function str2race(name: unknown): Race | null | undefined {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return races.find(r => r.name.toLowerCase().startsWith(lc)
        || r.adj.toLowerCase().startsWith(lc));
}

// C role.c:validgend(): the role's permitted-gender mask
// (roles[].allow & genders[].allow & ROLE_GENDMASK) as table membership.
export function validgend(role: RoleChoice, gender: Gender): boolean {
    const permitted = role && ROLE_SELECTION_RULES[role.key].genders;
    return !permitted || permitted.includes(gender.name);
}

// C role.c:str2gend(): resolve a gender by name prefix.
export function str2gend(name: unknown): Gender | null | undefined {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return genders.find(g => g.name.startsWith(lc));
}

// C role.c:validalign(): the role's and race's permitted-alignment masks
// (roles[].allow & races[].allow & aligns[].allow & ROLE_ALIGNMASK) as
// table membership.
export function validalign(role: RoleChoice, race: RaceChoice, alignment: Alignment): boolean {
    return (!role || ROLE_SELECTION_RULES[role.key].aligns.includes(alignment.name))
        && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}

// C role.c:str2align(): resolve an alignment by name prefix.
export function str2align(name: unknown): Alignment | null | undefined {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return aligns.find(a => a.name.startsWith(lc));
}

// C ref: role.c randomstr[] — the ROLE_RANDOM tail shared by all four
// str2XXX() matchers ('*', '@', or a prefix of "random").
export function randomCharacterOption(option: string | null): boolean {
    if (!option) return false;
    const text = option.toLowerCase();
    return text === '*' || text === '@' || 'random'.startsWith(text);
}

// C role.c:ok_role(): is the role compatible with the chosen (or absent)
// race, gender, and alignment?  C's IndexOkT branch and its any-candidate
// fallback are the one ternary below; gr.rfilter.roles[] is the role
// filter mask.
export function ok_role(choices: CharacterChoices, filters: CharacterFilters): boolean {
    const { role, race, gender, alignment } = choices;
    return (role ? [role] : nativeRoleChoices()).some(candidate =>
        !filters.roles.has(candidate.key)
        && (!race || validrace(candidate, race, null))
        && (!gender || validgend(candidate, gender))
        && (!alignment || validalign(candidate, null, alignment)));
}

// C role.c:ok_race(): is the race compatible with the chosen (or absent)
// role and alignment?  gr.rfilter.mask & races[].selfmask is the race
// filter mask.
export function ok_race(choices: CharacterChoices, filters: CharacterFilters): boolean {
    const { role, race, alignment } = choices;
    return (race ? [race] : races).some(candidate =>
        !filters.races.has(candidate.name) && validrace(role, candidate, alignment));
}

// C role.c:ok_gend(): is the gender compatible with the chosen (or
// absent) role and race?  Gender never consults the alignment.
export function ok_gend(choices: CharacterChoices, filters: CharacterFilters): boolean {
    const { role, gender } = choices;
    return (gender ? [gender] : genders).some(candidate =>
        !filters.genders.has(candidate.name) && validgend(role, candidate));
}

// C role.c:ok_align(): is the alignment compatible with the chosen (or
// absent) role and race?  Alignment never consults the gender.
export function ok_align(choices: CharacterChoices, filters: CharacterFilters): boolean {
    const { role, race, alignment } = choices;
    return (alignment ? [alignment] : aligns).some(candidate =>
        !filters.alignments.has(candidate.name) && validalign(role, race, candidate));
}

// C role.c:setrolefilter(): mark one facet value unacceptable; any
// character facet is accepted, trying roles first.
export function setrolefilter(filters: CharacterFilters, value: string): boolean {
    const role = str2role(value);
    if (role) { filters.roles.add(role.key); return true; }
    const race = str2race(value);
    if (race) { filters.races.add(race.name); return true; }
    const gender = str2gend(value);
    if (gender) { filters.genders.add(gender.name); return true; }
    const alignment = str2align(value);
    if (alignment) { filters.alignments.add(alignment.name); return true; }
    return false;
}

// C role.c:gotrolefilter(): does any filter mask hold an exclusion?
export function gotrolefilter(filters: CharacterFilters): boolean {
    return !!(filters.roles.size || filters.races.size || filters.genders.size || filters.alignments.size);
}

// C role.c:clearrolefilter(): clear one facet's filter mask.
export function clearrolefilter(filters: CharacterFilters, facet: CharacterFacet): void {
    switch (facet) {
    case 'role': filters.roles.clear(); break;
    case 'race': filters.races.clear(); break;
    case 'gender': filters.genders.clear(); break;
    case 'alignment': filters.alignments.clear(); break;
    }
}

// C role.c:promptsep(): the separator between the post attributes still
// to pick — a comma before all but the first and last, "and " before the
// last one when there are several.
function promptsep(prompt: string, numPostAttribs: number, rolePostAttribs: { count: number }): string {
    if (numPostAttribs > 1 && rolePostAttribs.count < numPostAttribs && rolePostAttribs.count > 1)
        prompt += ',';
    prompt += ' ';
    rolePostAttribs.count--;
    if (rolePostAttribs.count === 0 && numPostAttribs > 1)
        prompt += 'and ';
    return prompt;
}

// C role.c:role_gendercount(): how many genders the role permits
// (roles[].allow & ROLE_MALE/ROLE_FEMALE/ROLE_NEUTER).
function role_gendercount(role: RoleChoice): number {
    if (!role) return 0;
    return ROLE_SELECTION_RULES[role.key].genders?.length ?? genders.length;
}

// C role.c:race_alignmentcount(): how many alignments the race permits
// (races[].allow & ROLE_ALIGNMASK).
function race_alignmentcount(race: RaceChoice): number {
    if (!race) return 0;
    return RACE_SELECTION_RULES[race.name].aligns.length;
}

// C role.c:root_plselection_prompt(): build "<your lawful female gnomish
// cavewoman>" from the aspects already decided and record which facets
// the prompt must still ask for (C's gr.role_pa[] bits).  ok_align() and
// ok_race() consult the filter masks; the count guards use
// role_gendercount() and race_alignmentcount().
function root_plselection_prompt(
    choices: CharacterChoices, random: ReadonlySet<CharacterFacet>, filters?: CharacterFilters,
): { description: string[]; missing: Set<CharacterFacet> } {
    const { role, race, gender, alignment } = choices;
    const description: string[] = [];
    const missing = new Set<CharacterFacet>();
    const usableAlignment = alignment && !filters?.alignments.has(alignment.name)
        && validalign(role, race, alignment) ? alignment : null;
    if (usableAlignment) description.push(usableAlignment.name);
    else if (!race || !filters?.races.has(race.name) && validrace(role, race, null)
        && race_alignmentcount(race) > 1) missing.add('alignment');

    const genderCount = role_gendercount(role);
    if (gender) {
        if (!role || genderCount > 1 && role.name.m === role.name.f)
            description.push(gender.name);
    } else if (!role || genderCount > 1) missing.add('gender');

    if (race && (!role || !filters?.races.has(race.name) && validrace(role, race, usableAlignment)))
        description.push(role ? race.adj : race.name);
    else missing.add('race');

    if (role) {
        const name = gender?.name === 'female' ? role.name.f
            : !gender && !random.has('gender') && role.name.m !== role.name.f
                ? `${role.name.m}/${role.name.f}` : role.name.m;
        description.push(name);
    } else if (!random.has('role')) missing.add('role');
    if (!role && !race) description.push('character');

    return { description, missing };
}

// C role.c:build_plselection_prompt(): "Shall I pick a character's race,
// role, gender, and alignment for you? [ynaq]" — s_suffix() adds the
// possessive, with build_plselection_prompt()'s own exception for a
// combined "priest/priestess" name, and promptsep() joins the facets
// still to pick.
export function build_plselection_prompt(choices: CharacterChoices, random: ReadonlySet<CharacterFacet>,
    filters?: CharacterFilters): string {
    const { role, race, gender, alignment } = choices;
    const { description, missing } = root_plselection_prompt(choices, random, filters);
    const owner = role || race || random.has('race') ? 'your' : 'a';
    let prompt = `Shall I pick ${owner} ${description.join(' ')}`
        .replace('pick a character', 'pick character');
    // Native s_suffix() uses a bare apostrophe after s; this one combined
    // role name has an explicit exception in build_plselection_prompt().
    prompt += /s$/i.test(prompt) && !prompt.endsWith('Priest/Priestess') ? "'" : "'s";

    if (!missing.size) {
        if (!role && !random.has('role')) missing.add('role');
        if (!race && !random.has('race')) missing.add('race');
        if (!gender && !random.has('gender')) missing.add('gender');
        if (!alignment && !random.has('alignment')) missing.add('alignment');
    }
    // C appends in race, role, gender, alignment order (BP_RACE first).
    const rolePostAttribs = { count: missing.size };
    for (const facet of ['race', 'role', 'gender', 'alignment'] satisfies CharacterFacet[]) {
        if (!missing.has(facet)) continue;
        prompt = promptsep(prompt, missing.size, rolePostAttribs);
        prompt += facet;
    }
    return `${prompt} for you? [ynaq]`;
}


type Facet = CharacterFacet;
type Choices = CharacterChoices;
export interface CharacterOptions {
    role: string | null;
    race: string | null;
    gender: string | null;
    align: string | null;
    characterFilters?: CharacterFilters;
}
export interface SelectedCharacter {
    role: Role;
    race: Race;
    gender: Gender;
    alignment: Alignment;
    name: string;
}

// C role.c:genl_player_selection(): run the selection once and quit the
// game when the player cancels it; genl_player_setup() is the
// CharacterSelection class below.
export async function genl_player_selection(options: CharacterOptions,
    readName: () => Promise<ParsedCharacterName | null>): Promise<SelectedCharacter | null> {
    return new CharacterSelection(options, readName).choose();
}

const FACETS: readonly Facet[] = ['role', 'race', 'gender', 'alignment'];
// C ref: role.c role_menu_extra()'s RS_menu_let[] — the menu letters of
// the "pick <facet> first" routes.
const ROUTE_KEYS: Record<Facet, string> = { role: '?', race: '/', gender: '"', alignment: '[' };
// C ref: role.c genl_player_setup()'s end_menu() titles.
const TITLES: Record<Facet, string> = {
    role: 'Pick a role or profession', race: 'Pick a race or species',
    gender: 'Pick a gender or sex', alignment: 'Pick an alignment or creed',
};
const EMPTY_CHOICES: Choices = { role: null, race: null, gender: null, alignment: null };

// C role.c:genl_player_setup(): the selection loop's guts — the
// pick-for-you question, the facet menus, and the confirmation. C keeps
// the state in flags.initrole/initrace/initgend/initalign and gr.rfilter;
// this class holds it for one selection run.
class CharacterSelection {
    private choices: Choices;
    private readonly random = new Set<Facet>();
    private readonly filters: CharacterFilters;
    private name = game.plname;

    constructor(options: CharacterOptions, private readonly readName: () => Promise<ParsedCharacterName | null>) {
        this.filters = options.characterFilters ?? createCharacterFilters();
        this.choices = {
            role: str2role(options.role) ?? null,
            race: str2race(options.race) ?? null,
            gender: str2gend(options.gender) ?? null,
            alignment: str2align(options.align) ?? null,
        };
        for (const facet of FACETS) {
            const value = facet === 'alignment' ? options.align : options[facet];
            if (!this.choices[facet] && value
                && randomCharacterOption(value))
                this.random.add(facet);
        }
    }

    async choose(): Promise<SelectedCharacter | null> {
        const pickSomething = FACETS.some(facet => !this.choices[facet] && !this.random.has(facet));
        if (FACETS.some(facet => !this.choices[facet])) game._characterPickerUsed = true;
        this.rigid_role_checks();
        let pickForYou = 'n';
        if (FACETS.some(facet => !this.choices[facet] && !this.random.has(facet))) {
            const question = build_plselection_prompt(this.choices, this.random, this.filters);
            for (;;) {
                pickForYou = (await readSetupAnswer(question)).toLowerCase();
                if (pickForYou === 'q' || pickForYou === '\x1b') return null;
                if (' \n\r'.includes(pickForYou)) pickForYou = 'y';
                if (pickForYou === '*' || pickForYou === '@') pickForYou = 'a';
                if ('yna'.includes(pickForYou)) break;
            }
        }

        for (;;) {
            let next: Facet = 'role';
            let completed = false;
            do {
                const facet: Facet = next;
                const { role, race } = this.choices;
                // C's nextpick: after each facet the loop continues with
                // the first unresolved one.
                next = facet === 'role' ? 'race'
                    : facet === 'race' ? (role ? 'gender' : 'role')
                    : facet === 'gender' ? (!role ? 'role' : !race ? 'race' : 'alignment')
                    : (!role ? 'role' : !race ? 'race' : 'gender');
                completed = facet === 'alignment';
                if (this.validCurrentFacet(facet)) continue;
                if (pickForYou === 'y' || pickForYou === 'a' || this.random.has(facet)) {
                    // genl_player_setup() runs before the game windows
                    // exist, so pline() uses nonblocking raw_print().
                    if (this.candidates(facet).length === 0)
                        rawPrint(`Incompatible ${facet}!`);
                    this.pickRandom(facet);
                    continue;
                }
                let count = this.candidates(facet).length;
                if (count === 0) count = this.fallbackCandidates(facet).length;
                if (facet !== 'role' && count <= 1) {
                    this.pickSoleOrFallback(facet);
                    continue;
                }

                // maybe_skip_seps() measures before plsel_startmenu()'s
                // rigid checks resolve the forced facets, including the
                // rn2(1) for a rigid pick.
                const excess = this.maybe_skip_seps(facet);
                const key = await this.facetMenu(facet, excess);
                if (key === 'quit') return null;
                if (key === 'filter') {
                    this.clearFacet(facet);
                    const selectedFilters = await this.editFilters();
                    next = facet === 'role' || selectedFilters ? 'role' : facet;
                    continue;
                }
                const route = FACETS.find(candidate => key === `pick-${candidate}`);
                if (route) {
                    this.clearFacet(facet);
                    this.clearFacet(route);
                    next = route;
                } else if (key === 'random') this.pickRandom(facet);
                else this.setFacet(facet, key);
            } while (!completed || FACETS.some(facet => !this.choices[facet]));

            if (!pickSomething || pickForYou === 'a') return this.result();
            for (;;) {
                const window = this.plsel_startmenu('filter');
                addChoice(window, 'yes', 'y', 'Yes; start game', true);
                addChoice(window, 'again', 'n', 'No; choose role again');
                if (game.iflags.renameallowed)
                    addChoice(window, 'rename', 'a', 'Not yet; choose another name');
                addChoice(window, 'quit', 'q', 'Quit');
                const answer = await finishMenu(window,
                    `Is this ok? [yn${game.iflags.renameallowed ? 'a' : ''}q]`, 'yes');
                if (answer === 'quit') return null;
                if (answer === 'yes') return this.result();
                if (answer === 'rename') {
                    for (;;) {
                        const renamed = await this.readName();
                        // tty_askname() gave up; the game ends with the player.
                        if (renamed === null) return null;
                        this.name = renamed.name;
                        if (this.name) break;
                    }
                    game.plname = this.name;
                    continue;
                }
                pickForYou = 'n';
                this.choices = { ...EMPTY_CHOICES };
                this.random.clear();
                break;
            }
        }
    }

    private result(): SelectedCharacter {
        const { role, race, gender, alignment } = this.choices;
        if (!role || !race || !gender || !alignment)
            throw new Error('Character selection has unresolved facets');
        return { role, race, gender, alignment, name: this.name };
    }

    // C ref: role.c genl_player_setup()'s per-facet entry guards
    // ("if (RACE < 0 || !validrace(ROLE, RACE))" and its siblings).
    private validCurrentFacet(facet: Facet): boolean {
        const { role, race, gender, alignment } = this.choices;
        switch (facet) {
        case 'role': return !!role;
        case 'race': return !!race && (!role || ROLE_SELECTION_RULES[role.key].races.includes(race.name));
        case 'gender': return !!gender && (!role || validgend(role, gender));
        case 'alignment': return !!alignment && (!role || ROLE_SELECTION_RULES[role.key].aligns.includes(alignment.name))
            && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
        }
    }

    // C ref: role.c genl_player_setup()'s "ROLE = k" assignments.
    private clearFacet(facet: Facet): void {
        this.random.delete(facet);
        switch (facet) {
        case 'role': this.choices.role = null; break;
        case 'race': this.choices.race = null; break;
        case 'gender': this.choices.gender = null; break;
        case 'alignment': this.choices.alignment = null; break;
        }
    }

    private setFacet(facet: Facet, key: string): void {
        switch (facet) {
        case 'role': this.choices.role = roles.find(role => role.key === key) ?? null; break;
        case 'race': this.choices.race = races.find(race => race.name === key) ?? null; break;
        case 'gender': this.choices.gender = genders.find(gender => gender.name === key) ?? null; break;
        case 'alignment': this.choices.alignment = aligns.find(alignment => alignment.name === key) ?? null; break;
        }
        if (this.choices[facet]) this.random.delete(facet);
    }

    // C role.c:rigid_role_checks(): resolve ROLE_RANDOM facets before the
    // rigid picks, so a forced facet never prompts. pick_role(),
    // pick_race(), pick_gend(), and pick_align() are the per-facet
    // PICK_RANDOM draws through pickRandom() and the sole-candidate
    // rn2(1) below; randrole_filtered() is the honor-the-filters role
    // fallback.
    private rigid_role_checks(): void {
        // role.c resolves explicitly random facets before its rigid picks.
        for (const facet of ['role', 'race', 'alignment', 'gender'] satisfies Facet[]) {
            if (!this.random.has(facet)) continue;
            // A conflicting configured facet can leave pick_*() with no
            // candidates. Keep ROLE_RANDOM until makepicks corrects it.
            if (facet !== 'role' && this.candidates(facet).length === 0) continue;
            if (facet === 'role' && this.candidates(facet).length === 0) {
                const key = this.randrole_filtered();
                if (key) this.setFacet('role', key);
                continue;
            }
            this.pickRandom(facet);
        }
        if (!this.choices.role) return;
        for (const facet of ['race', 'alignment', 'gender'] satisfies Facet[]) {
            if (this.choices[facet] || this.random.has(facet)) continue;
            const candidates = this.candidates(facet);
            if (candidates.length === 1) {
                const key = candidates[rn2(1)];
                if (key) this.setFacet(facet, key);
            }
        }
    }

    // C role.c:randrole_filtered(): a random role that honors every
    // filter mask; the tail is randrole()'s unfiltered draw.
    private randrole_filtered(): string | undefined {
        // randrole_filtered() drops incompatible choices but keeps
        // each exclusion when an explicitly random role cannot fit.
        const permitted = this.roleCandidates(EMPTY_CHOICES);
        const candidates = permitted.length ? permitted : this.fallbackCandidates('role');
        return candidates[rn2(candidates.length)];
    }

    // C role.c:pick_role(): the PICK_RANDOM draw over candidates(), whose
    // filter loop is the ok_role()/ok_race()/ok_gend()/ok_align()
    // conjunction; pick_race(), pick_gend(), and pick_align() share it.
    // randrole(), randrace(), randgend(), and randalign() are the same
    // draw over the fallback tables (randrace() scales by 100 only for
    // the incompatible fallback), and the PICK_RIGID single-possibility
    // draws are rigid_role_checks()'s rn2(1).
    private pickRandom(facet: Facet): void {
        let candidates = this.candidates(facet);
        const fallback = candidates.length === 0;
        if (fallback) candidates = this.fallbackCandidates(facet);
        // Native randrace() scales by 100 only for the incompatible fallback.
        const index = fallback && facet === 'race'
            ? Math.floor(rn2(candidates.length * 100) / 100) : rn2(candidates.length);
        const key = candidates[index];
        if (!key) throw new Error(`No permitted ${facet} for character selection`);
        this.setFacet(facet, key);
    }

    // C ref: role.c genl_player_setup()'s manual-pick branch: the last
    // valid candidate when only one remains ("n == 1"), falling back to
    // the validrace()/validgend()/validalign() survivors when the ok_*()
    // set is empty ("n == 0").
    private pickSoleOrFallback(facet: Facet): void {
        const candidates = this.candidates(facet);
        const key = (candidates.length ? candidates : this.fallbackCandidates(facet)).at(-1);
        if (key) { this.setFacet(facet, key); return; }
        throw new Error(`No permitted ${facet} for character selection`);
    }

    // C ref: role.c randrole()/randrace()/randgend()/randalign() fallback
    // tables: every role, or the role's permitted races, genders, and
    // alignments.
    private fallbackCandidates(facet: Facet): string[] {
        const { role, race } = this.choices;
        switch (facet) {
        case 'role': return nativeRoleChoices().map(role => role.key);
        case 'race': return races.filter(candidate => !role
            || ROLE_SELECTION_RULES[role.key].races.includes(candidate.name)).map(candidate => candidate.name);
        case 'gender': return genders.filter(candidate => !role
            || validgend(role, candidate)).map(candidate => candidate.name);
        case 'alignment': return aligns.filter(candidate => (!role
            || ROLE_SELECTION_RULES[role.key].aligns.includes(candidate.name))
            && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(candidate.name))).map(candidate => candidate.name);
        }
    }

    // C ref: role.c pick_role()'s candidate set — the ok_*() conjunction
    // per facet; the menu variant adds the cross-checks setup_*menu()
    // makes (setup_racemenu() also asks ok_role() and ok_align(), &c).
    private candidates(facet: Facet, menu = false): string[] {
        const c = this.choices;
        switch (facet) {
        case 'role': return this.roleCandidates(c);
        case 'race': return races.filter(race => {
            const choice = { ...c, race };
            return ok_race(choice, this.filters) && (!menu
                || ok_role(choice, this.filters) && ok_align(choice, this.filters));
        }).map(race => race.name);
        case 'gender': return genders.filter(gender => {
            const choice = { ...c, gender };
            return ok_gend(choice, this.filters) && (!menu
                || ok_role(choice, this.filters) && ok_race(choice, this.filters));
        }).map(gender => gender.name);
        case 'alignment': return aligns.filter(alignment => {
            const choice = { ...c, alignment };
            return ok_align(choice, this.filters) && (!menu
                || ok_role(choice, this.filters) && ok_race(choice, this.filters));
        }).map(alignment => alignment.name);
        }
    }

    private roleCandidates(choices: Choices): string[] {
        return nativeRoleChoices().filter(role => {
            const choice = { ...choices, role };
            return ok_role(choice, this.filters) && ok_race(choice, this.filters)
                && ok_gend(choice, this.filters) && ok_align(choice, this.filters);
        }).map(role => role.key);
    }

    // C ref: role.c setup_rolemenu()'s rolenamebuf — the male, female, or
    // combined male/female role name.
    private roleName(role: Role, gender: GenderChoice, combined = false): string {
        if (gender?.value === 1) return role.name.f;
        if (!gender && combined && role.name.f !== role.name.m)
            return `${role.name.m}/${role.name.f}`;
        return role.name.m;
    }

    // C role.c:plsel_startmenu(): open the facet menu with the header
    // line of aspects chosen so far, after rigid_role_checks() has
    // narrowed the forced facets; the second maybe_skip_seps() call
    // drops the header separator when the menu overflows by two rows.
    private plsel_startmenu(aspect: Facet | 'filter'): TtyMenuWindow<string> {
        this.rigid_role_checks();
        const { role, race, gender, alignment } = this.choices;
        const roleName = role ? this.roleName(role, gender) : '<role>';
        const short = (value: string) => value.slice(0, 20);
        let header: string;
        if (this.name && role && race && gender && alignment) {
            // "<name> the <alignment> <gender> <race.adjective> <role>"
            header = [this.name, 'the', alignment.name, gender.name, race.adj, roleName].map(short).join(' ');
        } else {
            // "<role> <race.noun> <gender> <alignment>"
            header = [roleName, race?.noun ?? '<race>', gender?.name ?? '<gender>',
                alignment?.name ?? '<alignment>'].map(short).join(' ');
        }
        const window = tty_create_nhwindow<string>(NHW_MENU);
        addText(window, header);
        if (this.maybe_skip_seps(aspect) !== 2) addText(window, '');
        return window;
    }

    // C role.c:maybe_skip_seps(): the excess-line count (four header
    // lines, one per permitted role, random plus separator, five
    // footers) whose one-or-two surplus drops the menu separators; only
    // the role aspect is measured.
    private maybe_skip_seps(aspect: Facet | 'filter'): number {
        if (aspect !== 'role') return 0;
        const count = this.candidates('role').length + 12;
        const rows = game.nhDisplay?.rows ?? 24;
        return Math.max(0, count - rows);
    }

    // C ref: role.c genl_player_setup()'s per-facet menu: one
    // plsel_startmenu() header, the setup_rolemenu()/setup_racemenu()/
    // setup_gendmenu()/setup_algnmenu() entries, and role_menu_extra()'s
    // misc rows.
    private async facetMenu(facet: Facet, excess: number): Promise<string> {
        const window = this.plsel_startmenu(facet);
        this.setup_facet_menu(window, facet);
        this.role_menu_extra('random', window, true);
        if (facet !== 'role' || excess < 1 || excess > 2) addText(window, '');
        for (const other of FACETS) {
            if (other === facet) continue;
            this.role_menu_extra(other, window);
        }
        this.role_menu_extra('filter', window);
        this.role_menu_extra('quit', window);
        return finishMenu(window, TITLES[facet], 'random');
    }

    // C role.c:setup_rolemenu(), setup_racemenu(), setup_gendmenu(), and
    // setup_algnmenu(): the selection-menu variant (C's filtering TRUE)
    // — one row per still-permitted value, roles as "an Archeologist"
    // names with the combined male/female form. The filter-reset
    // variant is inside reset_role_filtering().
    private setup_facet_menu(window: TtyMenuWindow<string>, facet: Facet): void {
        let previous = '';
        for (const key of this.candidates(facet, true)) {
            let selector = key.charAt(0);
            let text = key;
            if (facet === 'role') {
                const role = roles.find(candidate => candidate.key === key);
                if (!role) continue;
                if (selector === previous) selector = selector.toUpperCase();
                previous = selector;
                text = withIndefiniteArticle(this.roleName(role, this.choices.gender, true));
            }
            tty_add_menu(window, {
                identifier: key, selector,
                group: facet !== 'role' ? selector.toUpperCase() : '', text,
            });
        }
    }

    // C role.c:role_menu_extra(): one miscellaneous menu entry — the
    // grayed-out "    role forces female"-style line when the facet's
    // value is already forced (four spaces of padding fake the graying),
    // or the "Pick <facet> first" route with its RS_menu_let selector;
    // ROLE_RANDOM, RS_filter, and ROLE_NONE are the Random, filter, and
    // Quit rows.
    private role_menu_extra(which: Facet | 'random' | 'filter' | 'quit',
        window: TtyMenuWindow<string>, preselect = false): void {
        if (which === 'random') {
            addChoice(window, 'random', '*', 'Random', preselect);
            return;
        }
        if (which === 'filter') {
            addChoice(window, 'filter', '~',
                `${gotrolefilter(this.filters) ? 'Reset' : 'Set'} role/race/&c filtering`);
            return;
        }
        if (which === 'quit') {
            addChoice(window, 'quit', 'q', 'Quit', preselect);
            return;
        }
        const forced = this.forcedValue(which);
        if (forced) addText(window, `    ${forced}`);
        else addChoice(window, `pick-${which}`, ROUTE_KEYS[which],
            `Pick${this.choices[which] ? ' another' : ''} ${which} first`);
    }

    // C ref: role.c role_menu_extra()'s constrainer detection — the role
    // or race table forcing one value, or the filters excluding every
    // other one.
    private forcedValue(facet: Facet): string | null {
        const { role, race, gender, alignment } = this.choices;
        const rules = role && ROLE_SELECTION_RULES[role.key];
        switch (facet) {
        case 'role':
            return nativeRoleChoices().every(candidate => candidate === role || this.filters.roles.has(candidate.key))
                ? 'filter forces role' : null;
        case 'race':
            if (rules?.races.length === 1) return `role forces ${rules.races[0]}`;
            if (rules && race && this.filterForces(rules.races, race.name, this.filters.races))
                return 'filter forces race';
            return null;
        case 'gender':
            if (rules?.genders?.length === 1) return `role forces ${rules.genders[0]}`;
            if (role && gender && this.filterForces(genders.map(candidate => candidate.name), gender.name, this.filters.genders))
                return 'filter forces gender';
            return null;
        case 'alignment':
            if (rules?.aligns.length === 1) return `role forces ${rules.aligns[0]}`;
            if (race && RACE_SELECTION_RULES[race.name].aligns.length === 1) return `race forces ${RACE_SELECTION_RULES[race.name].aligns[0]}`;
            if (alignment && this.filterForces(aligns.map(candidate => candidate.name), alignment.name, this.filters.alignments))
                return 'filter forces alignment';
            return null;
        }
    }

    // C ref: role.c role_menu_extra()'s "(allowmask & ~gr.rfilter.mask)
    // == selfmask" checks: the filters leave exactly this one value.
    private filterForces<T extends string>(keys: readonly T[], selected: T, excluded: ReadonlySet<T>): boolean {
        const remaining = keys.filter(key => !excluded.has(key));
        return remaining.length === 1 && remaining[0] === selected;
    }

    // C ref: role.c genl_player_setup()'s RS_filter choice: redo the
    // filters and restart the picks from the role (reset_role_filtering()
    // also clears every selection, C's "ROLE = RACE = GEND = ALGN =
    // ROLE_NONE").
    private async editFilters(): Promise<boolean> {
        const result = await reset_role_filtering(this.filters);
        if (result !== 'cancelled') {
            this.choices = { ...EMPTY_CHOICES };
            this.random.clear();
        }
        return result === 'filtered';
    }

}

// C ref: role.c genl_player_setup()'s yn_function() call for the
// pick-for-you question, drawn over the base window before the game
// windows exist.
async function readSetupAnswer(question: string): Promise<string> {
    const display = game.nhDisplay;
    if (!display) throw new Error('Character selection needs a display');
    // WIN_MAP does not exist yet. Paint the prompt over the base window
    // without flushing map cells over the name-entry copyright notice.
    const text = question + ' ';
    const width = display.cols - 1;
    for (let row = 0; row * width < text.length; row++) {
        display.clearRow(row);
        display.putstr(0, row, text.slice(row * width, (row + 1) * width), NO_COLOR);
    }
    display.setCursor((text.length - 1) % width + 1, Math.floor((text.length - 1) / width));
    const answer = await nhgetch();
    // tty_yn_function() clears WIN_MESSAGE when its prompt spans rows.
    if (text.length > width) {
        for (let row = 0; row * width < text.length; row++) display.clearRow(row);
    }
    return String.fromCharCode(answer);
}

// C ref: role.c role_menu_extra()'s add_menu_str() — a text-only row.
function addText(window: TtyMenuWindow<string>, text: string): void {
    tty_add_menu(window, { identifier: null, text });
}

// C ref: role.c role_menu_extra()'s add_menu() calls.
function addChoice(window: TtyMenuWindow<string>, identifier: string, selector: string,
    text: string, selected = false): void {
    tty_add_menu(window, { identifier, selector, text, itemflags: selected ? MENU_ITEMFLAGS_SELECTED : 0 });
}

// C ref: role.c genl_player_setup()'s end_menu()/select_menu()/
// destroy_nhwindow() tail, with the PICK_ONE preselection quirk: a
// second answer comes back alongside the preselected row.
async function finishMenu(window: TtyMenuWindow<string>, title: string, defaultChoice: string): Promise<string> {
    tty_end_menu(window, title);
    const result = await tty_select_menu(window, PICK_ONE, true);
    await tty_destroy_nhwindow(window);
    if (result.cancelled) return 'quit';
    // Explicitly toggling the preselected row off still chooses its default.
    // A different choice is returned alongside the preselected row by tty.
    return result.selections.find(item => item.identifier !== defaultChoice)?.identifier
        ?? result.selections[0]?.identifier ?? defaultChoice;
}

// C ref: role.c gr.rfilter — the zeroed filter masks before any
// ROLEDISCARD option is parsed.
export function createCharacterFilters(): CharacterFilters {
    return { roles: new Set(), races: new Set(), genders: new Set(), alignments: new Set() };
}

type FilterChoice = { facet: 'role'; value: RoleKey }
    | { facet: 'race'; value: RaceName }
    | { facet: 'gender'; value: GenderName }
    | { facet: 'alignment'; value: AlignmentName };

// C role.c:reset_role_filtering(): the "Pick all that apply" menu over
// every role, race, gender, and alignment.  The four loops are
// setup_rolemenu(), setup_racemenu(), setup_gendmenu(), and
// setup_algnmenu() with filtering FALSE — the unacceptable values are
// preselected; clearrolefilter(RS_filter) clears the old masks on any
// non-cancelled answer and the selections become the new masks.
// 'cancelled' is C's ESC (n < 0); 'empty' clears the masks like n == 0;
// 'filtered' is C's TRUE return.
export async function reset_role_filtering(
    filters: CharacterFilters,
): Promise<'cancelled' | 'empty' | 'filtered'> {
    const window = tty_create_nhwindow<FilterChoice>(NHW_MENU);
    try {
        await tty_start_menu(window);
        tty_add_menu(window, { identifier: null, text: 'Unacceptable roles' });
        let previousKey = '';
        for (const role of nativeRoleChoices()) {
            const first = role.name.m.charAt(0).toLowerCase();
            const key = first === previousKey ? first.toUpperCase() : first;
            previousKey = key;
            const name = role.name.m === role.name.f ? role.name.m : `${role.name.m}/${role.name.f}`;
            const choices = { role, race: null, gender: null, alignment: null };
            const allowed = ok_role(choices, filters)
                && ok_race(choices, filters)
                && ok_gend(choices, filters)
                && ok_align(choices, filters);
            tty_add_menu(window, {
                identifier: { facet: 'role', value: role.key }, selector: key,
                text: withIndefiniteArticle(name),
                itemflags: allowed ? 0 : MENU_ITEMFLAGS_SELECTED,
            });
        }
        tty_add_menu(window, { identifier: null, text: '' });
        tty_add_menu(window, { identifier: null, text: 'Unacceptable races' });
        for (const race of races) {
            const choices = { role: null, race, gender: null, alignment: null };
            const allowed = ok_race(choices, filters)
                && ok_role(choices, filters)
                && ok_align(choices, filters);
            tty_add_menu(window, {
                identifier: { facet: 'race', value: race.name }, selector: race.name.charAt(0).toUpperCase(),
                text: race.name, itemflags: allowed ? 0 : MENU_ITEMFLAGS_SELECTED,
            });
        }
        tty_add_menu(window, { identifier: null, text: '' });
        tty_add_menu(window, { identifier: null, text: 'Unacceptable genders' });
        for (const gender of genders) {
            const choices = { role: null, race: null, gender, alignment: null };
            const allowed = ok_gend(choices, filters)
                && ok_role(choices, filters)
                && ok_race(choices, filters);
            tty_add_menu(window, {
                identifier: { facet: 'gender', value: gender.name }, selector: gender.name.charAt(0).toUpperCase(),
                text: gender.name, itemflags: allowed ? 0 : MENU_ITEMFLAGS_SELECTED,
            });
        }
        tty_add_menu(window, { identifier: null, text: '' });
        tty_add_menu(window, { identifier: null, text: 'Unacceptable alignments' });
        for (const alignment of aligns) {
            const choices = { role: null, race: null, gender: null, alignment };
            const allowed = ok_align(choices, filters)
                && ok_role(choices, filters)
                && ok_race(choices, filters);
            tty_add_menu(window, {
                identifier: { facet: 'alignment', value: alignment.name }, selector: alignment.name.charAt(0).toUpperCase(),
                text: alignment.name, itemflags: allowed ? 0 : MENU_ITEMFLAGS_SELECTED,
            });
        }
        tty_end_menu(window, `Pick all that apply${gotrolefilter(filters) ? ' and/or unpick any that no longer apply' : ''}`);
        const result = await tty_select_menu(window, PICK_ANY, true);
        if (result.cancelled) return 'cancelled';
        filters.roles.clear();
        filters.races.clear();
        filters.genders.clear();
        filters.alignments.clear();
        for (const { identifier } of result.selections) {
            switch (identifier.facet) {
            case 'role': filters.roles.add(identifier.value); break;
            case 'race': filters.races.add(identifier.value); break;
            case 'gender': filters.genders.add(identifier.value); break;
            case 'alignment': filters.alignments.add(identifier.value); break;
            }
        }
        return result.selections.length ? 'filtered' : 'empty';
    } finally {
        await tty_destroy_nhwindow(window);
    }
}
