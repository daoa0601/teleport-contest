const EFFECTS = {
    'punished-ball-orbit': [
        ['punished with ball and chain', /You are being punished for your misbehavior!/],
        ['ball gets heavier', /Your iron ball gets heavier\./],
        ['ball dragged or smacked on stairs', /The iron ball (?:drags you downstairs!|smacks into you!)/],
        ['falls through a shaft', /fall down a shaft!|gaping hole under you!/],
        ['ball falls on head', /The iron ball falls on your head\./],
        ['hard helmet protects', /Fortunately, you are wearing a hard helmet\./],
    ],
    'long-worm-cleaving': [
        ['long worm appears', /[Ll]ong worm (?:appears|suddenly appears)/],
        ['worm tail cut', /You cut part of the tail off of [^.\n]+\./],
    ],
    'joust-mounted-lance': [
        ['steed saddled', /You put the saddle on [^.\n]+|[Ss]addled [^-.\n]*warhorse/],
        ['jousting hit', /You joust [^.\n]+!/],
    ],
    'wielded-special-strikes': [
        ['weapon coated in poison', /forms a coating on/],
        ['poison affects monster', /The poison doesn't seem to affect|appears confused|seems weakened|The poison was/],
        ['potion breaks on monster', /(?:flask|phial|bottle|jar|vial) [^.\n]*crashes on [^.\n]* and breaks into shards/],
        ['camera flash blinds monster', /[^.\n]* is blinded by the flash!/],
        ['camera destroyed by bashing', /You succeed in destroying [^.\n]*camera\.\s+Congratulations!/],
        ['monster turns to stone', /turns to stone[.!]/],
    ],
    'cleric-spellstorm': [
        ['priestly caster appears', /aligned priest|[Pp]riest(?:ess)? of [A-Z]/],
        ['hostile spell cast', /casts a spell/],
        ['wounding or blinding spell', /Wounds appear on your body!|Severe wounds|Scales cover your/],
    ],
    'monster-item-selfaid': [
        ['ogre appears', /ogre (?:appears|suddenly appears)/],
        ['monster eats to undo stoning', /eats (?:a|an|the) [^.\n]*corpse|has a very bad case of stomach acid/],
        ['monster cures its sliming', /(?:plays a fire horn|slime burns away|exhale[sd]?|burst of flame)/],
    ],
    'bag-of-holding-boom': [
        ['bag of holding acquired', /bag of holding/],
        ['explosion on insertion', /blasted by a magical\s+explosion!/],
    ],
    'metallivore-meals': [
        ['polymorphed into a metallivore', /You turn into [^.\n]*(?:xorn|rock mole)/],
        ['non-food meal', /[Tt]his [^.\n]+ is delicious/],
        ['glob eaten', /(?:eat|eating) (?:the |a )?(?:small )?glob of/],
        ['swallowed by a monster', /swallows you/],
    ],
    'shop-unpaid-ledger': [
        ['merchandise billed', /will cost you \d+ [a-z]+|\(unpaid, \d+ zorkmids\)/],
        ['unpaid inventory listed', /[Uu]npaid|[Tt]otal: *\d+/],
        ['purchase settled', /(?:bought|paid for) [^.\n]+ (?:for|at a cost of) \d+\s+gold\s+pieces/],
    ],
};
// Sweep the whole map with '>' probes after every step; the hero anchors at
// the north-west corner first, and Escape keys clear stuck trap queries.
function stairSweep(rows, width) {
    const actions = [];
    for (let i = 0; i < 85; i++)
        actions.push(keys('h'));
    for (let i = 0; i < 25; i++)
        actions.push(keys('k'));
    for (let row = 0; row < rows; row++) {
        const dir = row % 2 === 0 ? 'l' : 'h';
        for (let step = 0; step < width; step++) {
            actions.push(keys(dir), keys('>'));
            if (step % 6 === 5)
                actions.push(keys('\x1b'));
        }
        actions.push(keys('j'), keys('>'), keys('\x1b'));
    }
    return actions;
}
// Step off a wished hole and back into it, trying every axis.
function holeSteps() {
    const pairs = [['k', 'j'], ['j', 'k'], ['h', 'l'], ['l', 'h']];
    return pairs.flatMap(([off, back]) => [
        keys(off), keys(back), answer('Really step into that hole?', 'y')
    ]);
}
const CORPSE_THROWS = [
    ['lizard corpse', 'h'], ['acid blob corpse', 'y'], ['ochre jelly corpse', 'k'],
    ['yellow mold corpse', 'u'], ['lichen corpse', 'l'],
];
function corpseThrows() {
    return CORPSE_THROWS.flatMap(([item, direction]) => [
        choose(item, 't*'), answer('In what direction?', direction)
    ]);
}
export const ROUND14_RECIPES = {
    'punished-ball-orbit': recipe('Punish the hero, then drag, drop and fall with the iron ball.', effectsFor('punished-ball-orbit'), [
        ...wish('cursed scroll of punishment', 'cursed scroll of punishment', 'uncursed gauntlets of power', 'blessed dwarvish iron helm', 'blessed +50 gray dragon scale mail', 'uncursed ring of slow digestion'),
        identify(),
        keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'),
        choose('gauntlets of power', 'W*'),
        choose('dwarvish iron helm', 'W*'),
        choose('ring of slow digestion', 'P*'),
        answer('Which ring-finger', 'r'),
        keys('#wizintrinsic\r 9999'), choose('pass thru walls', ''), keys('\r'),
        choose('scrolls of punishment', 'r*'),
        choose('scroll of punishment', 'r*'),
        keys('hjklhykuljh' + 'unl'.repeat(3)),
        ...stairSweep(20, 85),
        ...wish('hole'),
        ...holeSteps(),
        ...stairSweep(12, 85),
    ]),
    'long-worm-cleaving': recipe('Cut a long worm apart with a wielded axe.', effectsFor('long-worm-cleaving'), [
        ...wish('blessed +3 axe', 'blessed +50 gray dragon scale mail', '12 blessed potions of full healing'),
        identify(),
        keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'),
        choose('axe', 'w*'),
        keys('\x07hostile long worm\r'),
        ...[...'hlhlyklj'].flatMap(step => [keys(step),
            ...[...'hykulnjb'].map(direction => keys(`F${direction}`)), keys('m.')]),
        ...[...'hykulnjb'].flatMap(direction => [keys(`F${direction}`), keys('m.')]),
        choose('of full healing', 'q*'),
        ...[...'lhkujlhn'].flatMap(step => [keys(step),
            ...[...'hykulnjb'].map(direction => keys(`F${direction}`)), keys('m.')]),
        ...[...'lujbhynk'].flatMap(direction => [keys(`F${direction}`), keys('m.')]),
    ]),
    'joust-mounted-lance': recipe('Ride a saddled warhorse and joust monsters with a lance.', effectsFor('joust-mounted-lance'), [
        ...wish('blessed +3 lance', 'blessed +50 gray dragon scale mail', 'blessed potion of full healing'),
        identify(),
        keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'),
        choose('lance', 'w*'),
        keys('\x07saddled tame warhorse\r'),
        keys('\x07saddled tame warhorse\r'),
        keys('\x07saddled tame warhorse\r'),
        ...[...'hykulnjb'].flatMap(direction => [keys('#ride\r'),
            answer('In what direction?', direction),
            answer('Force the mount to succeed?', 'y'),
            keys('\x07hostile ogre\r'),
            ...[...'hykulnjb'].map(attack => keys(`F${attack}`)),
            keys('m.')]),
    ]),
    'wielded-special-strikes': recipe('Hit monsters with wielded potions, poisoned darts, a camera and a cockatrice corpse.', effectsFor('wielded-special-strikes'), [
        ...wish('8 uncursed darts', 'potion of blindness', 'expensive camera', 'cockatrice corpse', 'uncursed gauntlets of power', '3 potions of sickness', 'blessed +50 gray dragon scale mail', '12 blessed potions of full healing'),
        identify(),
        keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'),
        choose('gauntlets of power', 'W*'),
        keys('#dip\r'),
        choose('dart', '*'),
        choose('of sickness', '*'),
        keys(','),
        keys('\x07hostile giant beetle\r'),
        ...[...'hykuln'].map(direction => [choose('dart', 't*'),
            answer('In what direction?', direction)]).flat(),
        keys('\x07hostile ogre\r'),
        choose('potion of blindness', 'w*'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        keys('\x07hostile ogre\r'),
        ...[...'hjkly'].map(direction => [choose('expensive camera', 'a*'),
            answer('In what direction?', direction)]).flat(),
        choose('expensive camera', 'w*'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        keys('\x07hostile ogre\r'),
        choose('cockatrice corpse', 'w*'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
    ]),
    'cleric-spellstorm': recipe('Endure aligned-priest clerical spellstorms at high level.', effectsFor('cleric-spellstorm'), [
        ...wish('blessed +50 gray dragon scale mail', 'uncursed ring of protection'),
        identify(),
        keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'),
        choose('ring of protection', 'P*'),
        answer('Which ring-finger', 'r'),
        keys('\x07hostile aligned priest\r'),
        answer('Creating human zombie instead', 'y'),
        ...Array.from({ length: 30 }, () => keys('m.')),
        keys('\x07hostile aligned priest\r'),
        answer('Creating human zombie instead', 'y'),
        ...Array.from({ length: 20 }, () => keys('m.')),
    ]),
    'monster-item-selfaid': recipe('Let ogres treat petrification with thrown acidic corpses and a hound burn off slime.', effectsFor('monster-item-selfaid'), [
        ...wish('blessed +50 gray dragon scale mail', '3 blessed potions of full healing', 'lizard corpse', 'acid blob corpse', 'ochre jelly corpse', 'yellow mold corpse', 'cockatrice corpse', 'uncursed gauntlets of power'),
        identify(),
        keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'),
        choose('gauntlets of power', 'W*'),
        keys('m.'.repeat(4)),
        keys(','),
        keys('\x07hostile ogre\r'),
        ...corpseThrows().map(step => step),
        keys('\x07hostile ogre\r'),
        choose('cockatrice corpse', 'w*'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        ...Array.from({ length: 4 }, () => keys('m.')),
        keys('#polyself\rgreen slime\r'),
        keys('\x07hostile hell hound pup\r'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        ...Array.from({ length: 12 }, (_, i) => i % 3 === 2
            ? choose('of full healing', 'q*') : keys('m.')),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        ...Array.from({ length: 8 }, () => keys('m.')),
        keys('#polyself\rhuman\r'),
    ]),
    'bag-of-holding-boom': recipe('Trigger a bag of holding explosion with a wand of cancellation.', effectsFor('bag-of-holding-boom'), [
        ...wish('bag of holding', 'wand of cancellation (0:6)'),
        identify(),
        choose('bag of holding', 'a*'),
        answer('Your bag of holding is empty', 'i'),
        answer('Do what with your bag of holding', 'i'),
        keys('a\r'),
        choose('wand of cancellation', '*'),
        keys('\r'),
    ]),
    'metallivore-meals': recipe('Polymorph into a metallivore and eat rings, non-food and globs, and survive swallowing.', effectsFor('metallivore-meals'), [
        ...wish('ring of fire resistance', 'whistle', 'glob of gray ooze', 'glob of gray ooze', '12 blessed potions of full healing'),
        identify(),
        keys('#polyself\rxorn\r'),
        choose('of gray ooze', 'e*'),
        choose('whistle', 'e*'),
        keys('\x07hostile purple worm\r'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        ...Array.from({ length: 24 }, (_, i) => i % 3 === 2
            ? choose('of full healing', 'q*') : keys('m.')),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        ...Array.from({ length: 12 }, () => keys('m.')),
    ]),
    'shop-unpaid-ledger': recipe('Bill, list, use and settle unpaid Minetown merchandise.', effectsFor('shop-unpaid-ledger'), [
        ...wish('blessed potion of object detection', '2000 gold pieces'),
        identify(),
        choose('minetn', 'm\x16'),
        choose('potion of object detection', 'q*'),
        keys('\x1b'),
        ...shopVisits(5),
        keys('e'), keys('\x1b'),
        keys('Ix'),
        keys('p'),
        answer('Itemized billing?', 'n'),
    ], { options: ['menustyle:traditional'] }),
};
export function validateRound14Recipe(name, session) {
    const effects = effectsFor(name);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, effect]) => ({ check, ok: effect.test(text), evidence: '' })),
    ];
}
// Teleport to offsets around the current spot and pick up what is there;
// unrecognized items prompt for a call name which is skipped.
function shopVisits(count) {
    const actions = [];
    for (let visit = 0; visit < count; visit++) {
        actions.push(keys('\x14'), answer('Where do you want to be teleported?', 'o'.repeat(visit % 10 + 1) + '.'), keys(','), answer('Call ', '\r'), keys(','), answer('Call ', '\r'), keys('\x1b'));
    }
    return actions;
}
function recipe(description, effects, actions, { options = [] } = {}) {
    return {
        roles: ['wizard', 'rogue', 'barbarian'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc, character }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r20\r'),
                    ...(typeof actions === 'function' ? actions(character) : actions), keys('\x1b:\x1b'),
                ] }],
    };
}
function effectsFor(name) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-14 recipe ${name}`);
    return effects;
}
function wish(...items) {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function identify() {
    return keys('\t\t\r');
}
function choose(target, openKeys) {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}
function answer(prompt, value) {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}
function keys(value) {
    return { type: 'keys', value, dismissMore: true };
}
//# sourceMappingURL=round14-recipes.mjs.map