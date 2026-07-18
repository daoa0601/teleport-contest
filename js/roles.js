// roles.js — Role, race, gender, alignment data.
// C ref: role.c — roles[], races[], aligns[], genders[]
//
// The complete quest/skill tables are still being ported, but startup uses
// real role records rather than a display-only name.  Attribute arrays keep
// NetHack's C order: Str, Int, Wis, Dex, Con, Cha.

export const roles = [
    { name: { m: 'Archeologist', f: 'Archeologist' }, mnum: 0 },
    { name: { m: 'Barbarian', f: 'Barbarian' }, mnum: 1 },
    { name: { m: 'Caveman', f: 'Cavewoman' }, mnum: 2 },
    { name: { m: 'Healer', f: 'Healer' }, mnum: 3 },
    { name: { m: 'Knight', f: 'Knight' }, mnum: 4 },
    { name: { m: 'Monk', f: 'Monk' }, mnum: 5 },
    { name: { m: 'Priest', f: 'Priestess' }, mnum: 6 },
    { key: 'ranger', name: { m: 'Ranger', f: 'Ranger' }, mnum: 7,
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
      hpadv: { infix: 13, inrnd: 0 },
      enadv: { infix: 1, inrnd: 0 },
      initrecord: 10,
      petnum: 16,
      greeting: 'Hello' },
    { name: { m: 'Rogue', f: 'Rogue' }, mnum: 8 },
    { key: 'samurai', name: { m: 'Samurai', f: 'Samurai' }, mnum: 9,
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
      hpadv: { infix: 13, inrnd: 0 },
      enadv: { infix: 1, inrnd: 0 },
      intrinsicFast: true,
      initrecord: 10,
      petnum: 16,
      greeting: 'Konnichi wa' },
    { key: 'tourist', name: { m: 'Tourist', f: 'Tourist' }, mnum: 10,
      title: [
          { m: 'Rambler', f: 'Rambler' },
          { m: 'Sightseer', f: 'Sightseer' },
      ],
      gods: { lawful: 'Blind Io', neutral: 'The Lady', chaotic: 'Offler' },
      attrbase: [7, 10, 6, 7, 7, 10],
      attrdist: [15, 10, 10, 15, 30, 20],
      hpadv: { infix: 8, inrnd: 0 },
      enadv: { infix: 1, inrnd: 0 },
      initrecord: 0,
      petnum: -1,
      greeting: 'Aloha',
    },
    { name: { m: 'Valkyrie', f: 'Valkyrie' }, mnum: 11 },
    { name: { m: 'Wizard', f: 'Wizard' }, mnum: 12 },
];

export const races = [
    { name: 'human', noun: 'human', adj: 'human', mnum: 0,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [118, 18, 18, 18, 18, 18],
      hpadv: { infix: 2, inrnd: 0 }, enadv: { infix: 1, inrnd: 0 } },
    { name: 'elf', noun: 'elf', adj: 'elven', mnum: 1,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [18, 20, 20, 18, 16, 18],
      hpadv: { infix: 1, inrnd: 0 }, enadv: { infix: 2, inrnd: 0 } },
    { name: 'dwarf', noun: 'dwarf', adj: 'dwarven', mnum: 2,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [118, 16, 16, 20, 20, 16],
      hpadv: { infix: 4, inrnd: 0 }, enadv: { infix: 0, inrnd: 0 } },
    { name: 'gnome', noun: 'gnome', adj: 'gnomish', mnum: 3,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [68, 19, 18, 18, 18, 18],
      hpadv: { infix: 1, inrnd: 0 }, enadv: { infix: 2, inrnd: 0 } },
    { name: 'orc', noun: 'orc', adj: 'orcish', mnum: 4,
      attrmin: [3, 3, 3, 3, 3, 3], attrmax: [68, 16, 16, 18, 18, 16],
      hpadv: { infix: 1, inrnd: 0 }, enadv: { infix: 1, inrnd: 0 } },
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
