// Role, race, gender, alignment data.
// C ref: role.c — roles[], races[], aligns[], genders[]
//
// The complete quest/skill tables are still being ported, but startup uses
// real role records rather than a display-only name.  Attribute arrays keep
// NetHack's C order: Str, Int, Wis, Dex, Con, Cha.
const roleRecords = [
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
export function nativeRoleAt(index) {
    const playerIndex = index === 7 ? 8 : index === 8 ? 7 : index;
    return roles.find(role => role.mnum === playerIndex);
}
// C ref: role.c roles[] spell statistics.  These fields feed the shared
// spell.c percent_success() calculation; they are live mechanics, not
// presentation defaults stored on individual spell records.
const ROLE_SPELLCASTING = {
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
export const roles = roleRecords.map(role => ({
    ...role,
    spellcasting: ROLE_SPELLCASTING[role.key],
}));
const M2_HUMAN = 0x00000008;
const M2_ELF = 0x00000010;
const M2_DWARF = 0x00000020;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
export const races = [
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
export const aligns = [
    { name: 'lawful', value: 1 },
    { name: 'neutral', value: 0 },
    { name: 'chaotic', value: -1 },
];
export const genders = [
    { name: 'male', value: 0 },
    { name: 'female', value: 1 },
];
// ── role.c function ports, in role.c source order ──
// C ref: role.c roles[] table order.  The JS role table keeps Ranger
// before Rogue for historical callers, while the C selection table
// deliberately keeps Rogue before Ranger; random character selection must
// use the latter order to preserve the PRNG-to-role mapping.
const CHARACTER_ROLE_ORDER = [
    'archeologist', 'barbarian', 'caveman', 'healer', 'knight', 'monk',
    'priest', 'rogue', 'ranger', 'samurai', 'tourist', 'valkyrie', 'wizard',
];
export function nativeRoleChoices() {
    return CHARACTER_ROLE_ORDER.flatMap(key => {
        const role = roles.find(candidate => candidate.key === key);
        return role ? [role] : [];
    });
}
export const ROLE_SELECTION_RULES = {
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
export const RACE_SELECTION_RULES = {
    human: { aligns: ['lawful', 'neutral', 'chaotic'] },
    elf: { aligns: ['chaotic'] },
    dwarf: { aligns: ['lawful'] },
    gnome: { aligns: ['neutral'] },
    orc: { aligns: ['chaotic'] },
};
// C role.c:str2role(): resolve a role by case-insensitive prefix, in
// native table order.
export function str2role(name) {
    if (typeof name !== 'string' || !name)
        return null;
    const lc = name.toLowerCase();
    // str2role() resolves ambiguous prefixes in native table order,
    // where Rogue precedes Ranger.
    for (let index = 0; index < roles.length; index++) {
        const role = nativeRoleAt(index);
        if (role && (role.name.m.toLowerCase().startsWith(lc)
            || role.name.f.toLowerCase().startsWith(lc)))
            return role;
    }
    return undefined;
}
// C role.c:validrace(): the role's permitted-race mask and the race's
// alignment mask (roles[].allow & races[].allow) as table membership;
// IndexOkT bounds are the typed lookups.  ok_race() adds the filter
// masks and the any-candidate question; validrace() only checks the
// two tables.
export function validrace(role, race, alignment) {
    return (!role || ROLE_SELECTION_RULES[role.key].races.includes(race.name))
        && (!alignment || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}
// C role.c:str2race(): resolve a race by name or adjective prefix.
export function str2race(name) {
    if (typeof name !== 'string' || !name)
        return null;
    const lc = name.toLowerCase();
    return races.find(r => r.name.toLowerCase().startsWith(lc)
        || r.adj.toLowerCase().startsWith(lc));
}
// C role.c:validgend(): the role's permitted-gender mask
// (roles[].allow & genders[].allow & ROLE_GENDMASK) as table membership.
export function validgend(role, gender) {
    const permitted = role && ROLE_SELECTION_RULES[role.key].genders;
    return !permitted || permitted.includes(gender.name);
}
// C role.c:str2gend(): resolve a gender by name prefix.
export function str2gend(name) {
    if (typeof name !== 'string' || !name)
        return null;
    const lc = name.toLowerCase();
    return genders.find(g => g.name.startsWith(lc));
}
// C role.c:validalign(): the role's and race's permitted-alignment masks
// (roles[].allow & races[].allow & aligns[].allow & ROLE_ALIGNMASK) as
// table membership.
export function validalign(role, race, alignment) {
    return (!role || ROLE_SELECTION_RULES[role.key].aligns.includes(alignment.name))
        && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}
// C role.c:str2align(): resolve an alignment by name prefix.
export function str2align(name) {
    if (typeof name !== 'string' || !name)
        return null;
    const lc = name.toLowerCase();
    return aligns.find(a => a.name.startsWith(lc));
}
// C ref: role.c randomstr[] — the ROLE_RANDOM tail shared by all four
// str2XXX() matchers ('*', '@', or a prefix of "random").
export function randomCharacterOption(option) {
    if (!option)
        return false;
    const text = option.toLowerCase();
    return text === '*' || text === '@' || 'random'.startsWith(text);
}
// C role.c:promptsep(): the separator between the post attributes still
// to pick — a comma before all but the first and last, "and " before the
// last one when there are several.
function promptsep(prompt, numPostAttribs, rolePostAttribs) {
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
function role_gendercount(role) {
    if (!role)
        return 0;
    return ROLE_SELECTION_RULES[role.key].genders?.length ?? genders.length;
}
// C role.c:race_alignmentcount(): how many alignments the race permits
// (races[].allow & ROLE_ALIGNMASK).
function race_alignmentcount(race) {
    if (!race)
        return 0;
    return RACE_SELECTION_RULES[race.name].aligns.length;
}
// C role.c:root_plselection_prompt(): build "<your lawful female gnomish
// cavewoman>" from the aspects already decided and record which facets
// the prompt must still ask for (C's gr.role_pa[] bits).  ok_align() and
// ok_race() consult the filter masks; the count guards use
// role_gendercount() and race_alignmentcount().
function root_plselection_prompt(choices, random, filters) {
    const { role, race, gender, alignment } = choices;
    const description = [];
    const missing = new Set();
    const usableAlignment = alignment && !filters?.alignments.has(alignment.name)
        && validalign(role, race, alignment) ? alignment : null;
    if (usableAlignment)
        description.push(usableAlignment.name);
    else if (!race || !filters?.races.has(race.name) && validrace(role, race, null)
        && race_alignmentcount(race) > 1)
        missing.add('alignment');
    const genderCount = role_gendercount(role);
    if (gender) {
        if (!role || genderCount > 1 && role.name.m === role.name.f)
            description.push(gender.name);
    }
    else if (!role || genderCount > 1)
        missing.add('gender');
    if (race && (!role || !filters?.races.has(race.name) && validrace(role, race, usableAlignment)))
        description.push(role ? race.adj : race.name);
    else
        missing.add('race');
    if (role) {
        const name = gender?.name === 'female' ? role.name.f
            : !gender && !random.has('gender') && role.name.m !== role.name.f
                ? `${role.name.m}/${role.name.f}` : role.name.m;
        description.push(name);
    }
    else if (!random.has('role'))
        missing.add('role');
    if (!role && !race)
        description.push('character');
    return { description, missing };
}
// C role.c:build_plselection_prompt(): "Shall I pick a character's race,
// role, gender, and alignment for you? [ynaq]" — s_suffix() adds the
// possessive, with build_plselection_prompt()'s own exception for a
// combined "priest/priestess" name, and promptsep() joins the facets
// still to pick.
export function build_plselection_prompt(choices, random, filters) {
    const { role, race, gender, alignment } = choices;
    const { description, missing } = root_plselection_prompt(choices, random, filters);
    const owner = role || race || random.has('race') ? 'your' : 'a';
    let prompt = `Shall I pick ${owner} ${description.join(' ')}`
        .replace('pick a character', 'pick character');
    // Native s_suffix() uses a bare apostrophe after s; this one combined
    // role name has an explicit exception in build_plselection_prompt().
    prompt += /s$/i.test(prompt) && !prompt.endsWith('Priest/Priestess') ? "'" : "'s";
    if (!missing.size) {
        if (!role && !random.has('role'))
            missing.add('role');
        if (!race && !random.has('race'))
            missing.add('race');
        if (!gender && !random.has('gender'))
            missing.add('gender');
        if (!alignment && !random.has('alignment'))
            missing.add('alignment');
    }
    // C appends in race, role, gender, alignment order (BP_RACE first).
    const rolePostAttribs = { count: missing.size };
    for (const facet of ['race', 'role', 'gender', 'alignment']) {
        if (!missing.has(facet))
            continue;
        prompt = promptsep(prompt, missing.size, rolePostAttribs);
        prompt += facet;
    }
    return `${prompt} for you? [ynaq]`;
}
//# sourceMappingURL=roles.js.map