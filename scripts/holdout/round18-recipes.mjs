const EFFECTS = {
    'lit-candle-stacks': [['candles lit', /candles.*(?:flames?|lit)/], ['lit candle dropped', /You drop.*candle.*lit/], ['lit candles recovered', /candle.*lit.*\(lit\)|candles.*\(lit\)/]],
    'candelabrum-refill': [['first candle attached', /attach 1 candle/], ['new candles ignite', /new candles magically ignite/], ['seven candles attached', /seven lit candles attached/]],
    'artifact-light-blessing': [['artifact dims', /It shines less brightly/], ['artifact brightens', /It shines brighter/]],
    'tin-opener-meal': [['opener used', /Using your.*tin opener/], ['tin opened', /(?:easily open|succeed in opening) the tin/], ['contents eaten', /You consume.*lizard/]],
    'dagger-tin-meal': [['dagger used', /Using your.*dagger/], ['tin opened', /succeed in opening the tin/], ['contents eaten', /You consume.*lizard/]],
    'dangerous-food-warning': [['danger sensed', /could be something very dangerous/], ['warning consumed', /nose stops tingling/]],
    'glob-meal': [['glob decays', /glob of gray ooze shrinks/], ['glob eaten', /finish eating the.*glob/]],
    'cream-face-wiping': [['face covered', /(?:face|yourself).*cream|glop of cream|sticky goop/], ['face cleaned', /face feels clean|got the glop off/]],
    'armor-already-worn': [['second wear refused', /already wearing that/]],
    'corpse-without-gloves': [['unprotected corpse wielded', /now wield a cockatrice corpse in your bare hands/], ['hero survives', /OK, so you don.t die/]],
    'pet-corpse-resistance': [['pet eats corpse', /(?:dog|hound).*eats.*red dragon corpse/], ['pet gains resistance', /(?:dog|hound).*shivers slightly/]],
    'medusa-response': [['gaze reflected', /(?:gaze|image).*reflect|Medusa.*(?:stone|stiffens)/]],
    'mimic-healing': [['disguise healed', /seems a more vivid/]],
    'quest-leader-death': [['leader killed', /kill Neferet the Green/]],
    'quest-nemesis-death': [['nemesis killed', /kill the Dark One/], ['death acknowledged', /body begins to shrivel|cloud of choking dust/]],
    'vlad-ladder-travel': [['ladder found', /ladder (?:up|down)/], ['ladder used', /(?:climb|descend).*ladder/], ['ladder resists lateral digging', /ladder is unaffected/]],
    'oracle-room-sounds': [['oracle heard', /You hear (?:a strange wind|convulsive ravings|snoring snakes)/]],
    'hungry-pet-sounds': [['pet begs', /whinnies|I.m hungry|seems famished/]],
    'demon-prince-summoning': [['reinforcements appear', /appears in a (?:cloud|burst|flash) of/]],
    'troll-corpse-revival': [['corpse revives', /troll rises from the dead/]],
    'object-hole-transit': [['object migrates', /(?:flint|rock).*falls through the hole/]],
    'watch-door-warning': [['door damage warned', /stop damaging that door/], ['arrest ordered', /Halt, (?:vandal|thief)!.*under arrest/]],
};
export const ROUND18_RECIPES = {
    'lit-candle-stacks': recipe('lit-candle-stacks', 'Split a burning stack of candles, then pick it up and merge it.', [
        ...wish(...Array.from({ length: 4 }, () => 'uncursed wax candle')), identify(),
        choose('wax candles', 'a*'), choose('wax candles', 'd1*'), keys(','), keys('i \x1b'),
    ]),
    'candelabrum-refill': recipe('candelabrum-refill', 'Add candles to a burning candelabrum until all seven are lit.', [
        ...wish('uncursed Candelabrum of Invocation', 'uncursed wax candle'), identify(),
        choose('wax candle', 'a*'), answer('Attach ', 'y'), choose('Candelabrum', 'a*'),
        ...wish(...Array.from({ length: 6 }, () => 'uncursed wax candle')), identify(),
        choose('wax candles', 'a*'), answer('Attach ', 'y'), keys('i \x1b'),
    ]),
    'artifact-light-blessing': recipe('artifact-light-blessing', 'Change the blessing of wielded Sunsword and its light.', [
        ...wish('uncursed Sunsword'), identify(), choose('Sunsword', 'w*'),
        ...['unholy water', 'holy water', 'holy water', 'unholy water'].flatMap(water => [
            ...wish(`potion of ${water}`), identify(), choose('Sunsword', '#dip\r*'),
            answer('Dip it into the', 'n'), choose(water, '*'),
        ]),
    ]),
    'tin-opener-meal': recipe('tin-opener-meal', 'Wield a tin opener by applying it and eat its opened tin.', [
        ...wish('uncursed tin opener', 'uncursed tin of homemade lizard meat'), identify(),
        choose('tin opener', 'a*'), choose('tin of', '*'), answer('Eat it?', 'y'), ...wait(6), answer('Eat it?', 'y'),
    ]),
    'dagger-tin-meal': recipe('dagger-tin-meal', 'Open a tin with a wielded dagger.', [
        ...wish('uncursed dagger named opener', 'uncursed tin of homemade lizard meat'), identify(), ...clearMonsters(),
        choose('dagger named opener', 'w*'), choose('tin of', 'me*'), answer('Eat it?', 'y'), ...wait(6),
    ]),
    'dangerous-food-warning': recipe('dangerous-food-warning', 'Detect and decline a petrifying meal.', [
        ...wish('uncursed leather gloves'), identify(), choose('leather gloves', 'W*'),
        ...wish('blessed scroll of food detection', 'uncursed cockatrice corpse'), identify(),
        choose('scroll of food detection', 'r*'), answer('(For instructions type', '\x1b'),
        choose('cockatrice corpse', 'me*'), answer('The corpse smells', 'n'),
    ]),
    'glob-meal': recipe('glob-meal', 'Eat a glob while its decay timer is active.', [
        ...wish('uncursed large glob of gray ooze'), identify(), ...clearMonsters(), ...wait(26),
        ...clearMonsters(), choose('glob of gray ooze', 'me*'), ...wait(30),
    ]),
    'cream-face-wiping': recipe('cream-face-wiping', 'Apply a cream pie to the face and wipe it clean.', [
        ...wish('uncursed cream pie'), identify(), choose('cream pie', 'a*'), keys('#wipe\r'), ...wait(6),
    ]),
    'armor-already-worn': recipe('armor-already-worn', 'Try to wear gloves which are already worn.', [
        ...wish('uncursed leather gloves'), identify(), choose('leather gloves', 'W*'), choose('leather gloves', 'W*'),
    ]),
    'corpse-without-gloves': recipe('corpse-without-gloves', 'Remove gloves while wielding a petrifying corpse.', [
        ...wish('uncursed leather gloves'), identify(), choose('leather gloves', 'W*'),
        ...wish('uncursed cockatrice corpse'), identify(), choose('cockatrice corpse', 'w*'), choose('leather gloves', 'T*'),
        answer('Take off your gloves despite', 'yes\r'), answer('Die?', 'n'),
    ]),
    'pet-corpse-resistance': recipe('pet-corpse-resistance', 'Feed a pet a red dragon corpse to confer fire resistance.', [
        ...practiceRoom(), ...wish('blessed figurine of a large dog'), identify(),
        choose('figurine of a large dog', 'a*'), answer('In what direction?', 'l'), ...wish('uncursed red dragon corpse'), keys('mh'), ...wait(80),
    ]),
    'medusa-response': recipe('medusa-response', 'Attack Medusa while wearing reflection.', [
        ...protection(), ...wish('uncursed amulet of reflection'), identify(), choose('amulet of reflection', 'P*'),
        ...create('hostile Medusa'), ...fight(16),
    ]),
    'mimic-healing': recipe('mimic-healing', 'Heal a mimic while it is disguised as an object.', [
        ...practiceRoom(),
        ...[...'ljhhkkll'].flatMap(direction => [keys(`m${direction}`), ...wish('1 gold piece'), keys('d$')]), keys('mb'),
        ...create('peaceful small mimic'),
        ...[...'hykulnjb'].flatMap(direction => [choose('healing', '#wizcast\r'), answer('In what direction?', direction)]),
    ]),
    'quest-leader-death': recipe('quest-leader-death', 'Slay the native Wizard quest leader.', [
        ...protection(), choose('Wiz-strt', 'm\x16'), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '\\h.'),
        keys('#wizkill\r'), answer('Pick first monster to slay:', 'l.\x1b'),
    ]),
    'quest-nemesis-death': recipe('quest-nemesis-death', 'Slay the native Wizard quest nemesis.', [
        ...protection(), ...intrinsic('monster detection', 1000), choose('Wiz-goal', 'm\x16'), keys('#wizmap\r'),
        ...Array.from({ length: 3 }, () => [keys('#wizkill\r'), answer('Pick first monster to slay:', '_.\x1b')]).flat(),
    ]),
    'vlad-ladder-travel': recipe('vlad-ladder-travel', 'Traverse the ladders between the floors of Vlad\'s tower.', [
        ...protection(), ...intrinsic('pass thru walls', 1000), choose('tower2', 'm\x16'), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '>.'), ...wish('uncursed wand of digging (0:8)'), identify(),
        choose('wand of digging', 'z*'), answer('In what direction?', '>'), keys('>'), ...wait(2), keys('<'),
        keys('mh'), ...wish('fountain', 'floor', 'pit'), keys('mhml'),
        choose('wand of digging', 'z*'), answer('In what direction?', 'l'),
    ]),
    'oracle-room-sounds': recipe('oracle-room-sounds', 'Wait out of sight of the Oracle until her room produces a sound.', [
        ...protection(), choose('oracle', 'm\x16'), ...intrinsic('blinded', 1600), ...wait(1200),
    ]),
    'hungry-pet-sounds': recipe('hungry-pet-sounds', 'Listen to a hungry warhorse while the hero cannot see it.', [
        ...protection(), keys('#levelchange\r'), answer('To what experience level', '1\r'),
        ...practiceRoom(), ...stoneShelter(), ...create('tame warhorse'), ...intrinsic('blinded', 2000), ...wait(1650),
    ]),
    'demon-prince-summoning': recipe('demon-prince-summoning', 'Summon demons with the native special throne in Vlad\'s tower.', [
        ...protection(), ...intrinsic('see invisible', 1000), choose('tower1', 'm\x16'),
        ...Array.from({ length: 64 }, () => [
            ...wish('throne', 'blessed scroll of genocide'), identify(), keys('#sit\r'), answer('Throne sit effect', '9\r'),
            answer('Die?', 'n'), answer('How much will you offer?', '0\r'),
            choose('scroll of genocide', 'r*'), answer('What class of monsters', '*\r'),
        ]).flat(),
    ]),
    'troll-corpse-revival': recipe('troll-corpse-revival', 'Wait beside a troll corpse until it revives.', [
        ...protection(), ...practiceRoom(),
        ...Array.from({ length: 3 }, () => [
            ...wish('uncursed troll corpse'), identify(), choose('troll corpse', 'd*'), keys('ml'), ...wait(60), keys('mh'),
        ]).flat(),
    ]),
    'object-hole-transit': recipe('object-hole-transit', 'Kick an object across a hole so it falls to the next level.', [
        ...practiceRoom(), ...clearMonsters(), ...wish('hole'), keys('mh'),
        ...Array.from({ length: 12 }, () => [
            ...wish('uncursed flint'), identify(), choose('flint', 'd*'), keys('mh'), ...wish('fountain', 'floor'),
            keys('\x04'), answer('In what direction?', 'l'), keys('ml'),
        ]).flat(),
    ]),
    'watch-door-warning': recipe('watch-door-warning', 'Damage a door in sight of the Minetown watch, then repeat it.', [
        ...protection(), ...intrinsic('pass thru walls', 1000), choose('minetn', 'm\x16'), ...clearMonsters(), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '_h.'), ...practiceRoom(), keys('mh'),
        ...Array.from({ length: 16 }, () => [
            ...clearMonsters(), keys('ml'), ...wish('wall', 'locked door'), keys('mh'),
            ...create('peaceful watchman'), answer('Creating ', 'y'),
            keys('\x04'), answer('In what direction?', 'l'), answer('Really attack', 'n'),
        ]).flat(),
    ]),
};
export function validateRound18Recipe(name, session) {
    const effects = effectsFor(name);
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step => step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}
function recipe(name, description, actions) {
    return {
        roles: ['wizard'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'],
        description, success: effectsFor(name).map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r'), answer('To what experience level', '30\r'), ...actions, keys('\x1b:\x1b'),
                ] }],
    };
}
function effectsFor(name) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-18 recipe ${name}`);
    return effects;
}
function protection() {
    return [...wish('blessed +50 gray dragon scale mail', 'uncursed ring of slow digestion'), identify(), keys('T'), ...wait(5),
        choose('gray dragon scale mail', 'W*'), ...wait(5), choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l')];
}
function clearMonsters() {
    return [...wish('blessed scroll of genocide'), identify(), choose('scroll of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function practiceRoom() {
    const actions = [...clearMonsters(), ...intrinsic('pass thru walls', 1000), keys('mhmk')];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 2)
                actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 2)
            actions.push(keys('mj'));
    }
    actions.push(keys('mhmk'));
    return actions;
}
function stoneShelter() {
    const actions = [keys('mhmhmkmk')];
    for (const direction of 'lllljjjjhhhhkkkk')
        actions.push(...wish('wall'), keys(`m${direction}`));
    actions.push(keys('mlmlmjmj'));
    return actions;
}
function wish(...items) {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster) {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`)];
}
function intrinsic(property, turns) {
    const laterPage = ['pass thru walls', 'fire resistance', 'see invisible'].includes(property);
    return [keys(`#wizintrinsic\r${laterPage ? ' ' : ''}${turns}`), choose(property, ''), keys('\r')];
}
function wait(turns) {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r'), answer('Die?', 'n')]).flat();
}
function fight(turns) {
    return [...'hykulnjb'.repeat(Math.ceil(turns / 8))].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y'), answer('Die?', 'n')]);
}
function identify() { return keys('\t\t\r'); }
function choose(target, openKeys) { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt, value) { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value) { return { type: 'keys', value, dismissMore: true }; }
//# sourceMappingURL=round18-recipes.mjs.map