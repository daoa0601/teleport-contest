// roles.js — Role, race, gender, alignment data.
// C ref: role.c — roles[], races[], aligns[], genders[]
//
// The complete quest/skill tables are still being ported, but startup uses
// real role records rather than a display-only name.  Attribute arrays keep
// NetHack's C order: Str, Int, Wis, Dex, Con, Cha.

export const roles = [
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
      leaderName: 'Lord Carnarvon',
      guardianName: 'student',
      guardianPlural: 'students',
      nemesisName: 'the Minion of Huhetotl',
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
      leaderName: 'Pelias',
      guardianName: 'chieftain',
      guardianPlural: 'chieftains',
      nemesisName: 'Thoth Amon',
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
      artifactName: 'the Sceptre of Might',
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
      artifactName: 'the Staff of Aesculapius',
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
      leaderName: 'King Arthur',
      guardianName: 'page',
      guardianPlural: 'pages',
      nemesisName: 'Ixoth',
      artifactName: 'the Magic Mirror of Merlin',
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
      artifactName: 'the Eyes of the Overworld',
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
      leaderName: 'the Arch Priest',
      guardianName: 'Acolyte',
      guardianPlural: 'Acolytes',
      nemesisName: 'Nalzok',
      artifactName: 'the Mitre of Holiness',
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
      artifactName: 'the Longbow of Diana',
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
      artifactName: 'the Master Key of Thievery',
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
      artifactName: 'the Tsurugi of Muramasa',
      greeting: 'Konnichi wa', goodbye: 'Sayonara' },
    { key: 'tourist', filecode: 'Tou', name: { m: 'Tourist', f: 'Tourist' }, mnum: 10,
      title: [
          { m: 'Rambler', f: 'Rambler' },
          { m: 'Sightseer', f: 'Sightseer' },
      ],
      gods: { lawful: 'Blind Io', neutral: 'The Lady', chaotic: 'Offler' },
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
      artifactName: 'the Platinum Yendorian Express Card',
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
      artifactName: 'the Orb of Fate',
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
      leaderName: 'Neferet the Green',
      guardianName: 'apprentice',
      guardianPlural: 'apprentices',
      nemesisName: 'the Dark One',
      artifactName: 'the Eye of the Aethiopica',
      enemy1num: 129,
      enemy1sym: 28,
      enemy2num: 232,
      enemy2sym: 39,
      greeting: 'Hello', goodbye: 'Goodbye' },
];

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

for (const role of roles)
    role.spellcasting = ROLE_SPELLCASTING[role.key];

export const races = [
    { name: 'human', noun: 'human', adj: 'human', mnum: 0,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [118, 18, 18, 18, 18, 18],
      hpadv: {
          infix: 2, inrnd: 0, lofix: 0, lornd: 2, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 1, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0,
      } },
    { name: 'elf', noun: 'elf', adj: 'elven', mnum: 1,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [18, 20, 20, 18, 16, 18],
      hpadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 1, hirnd: 0,
      },
      enadv: {
          infix: 2, inrnd: 0, lofix: 3, lornd: 0, hifix: 3, hirnd: 0,
      } },
    { name: 'dwarf', noun: 'dwarf', adj: 'dwarven', mnum: 2,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [118, 16, 16, 20, 20, 16],
      hpadv: {
          infix: 4, inrnd: 0, lofix: 0, lornd: 3, hifix: 2, hirnd: 0,
      },
      enadv: {
          infix: 0, inrnd: 0, lofix: 0, lornd: 0, hifix: 0, hirnd: 0,
      } },
    { name: 'gnome', noun: 'gnome', adj: 'gnomish', mnum: 3,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [68, 19, 18, 18, 18, 18],
      hpadv: {
          infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 0,
      },
      enadv: {
          infix: 2, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0,
      } },
    { name: 'orc', noun: 'orc', adj: 'orcish', mnum: 4,
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

export function findRole(name) {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return roles.find(r => r.name.m.toLowerCase().startsWith(lc)
        || r.name.f.toLowerCase().startsWith(lc));
}

export function findRace(name) {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return races.find(r => r.name.toLowerCase().startsWith(lc)
        || r.adj.toLowerCase().startsWith(lc));
}

export function findAlignment(name) {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return aligns.find(a => a.name.startsWith(lc));
}

export function findGender(name) {
    if (typeof name !== 'string' || !name) return null;
    const lc = name.toLowerCase();
    return genders.find(g => g.name.startsWith(lc));
}
