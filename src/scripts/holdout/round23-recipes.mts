import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];
const SHOP_WALL_DIRECTIONS: readonly (readonly [string, string])[] = [
    ['h', 'l'], ['k', 'j'], ['l', 'h'], ['j', 'k'],
];
const EFFECTS: Record<string, readonly Effect[]> = {
    'plenty-horn-meals': [['food produced', /Some food spills out/]],
    'tree-fruit-kicking': [['fruit falls', /(?:Some .+ fall|An? .+ falls) from the tree/]],
    'peaceful-hat-greeting': [['hat doffed', /You briefly doff your hat/], ['greeting returned', /gnome (?:waves|tips .+ in response)/]],
    'hostile-hat-greeting': [['rude reply', /gnome (?:curses|gestures rudely|gestures offensively).+at you/]],
    'leprechaun-gold-theft': [['gold stolen', /Your purse feels heavier/]],
    'identify-scroll-menu': [['identification menu', /What would you like to identify first/], ['item identified', /^[a-z] - an? (?:uncursed )?\+2 dagger named study target/m]],
    'engraving-listing': [['engraving written', /You write in the dust/], ['engraving listed', /[Ss]een or remembered engravings/]],
    'weapon-skill-wishes': [['polearm received', /[+-]\d+ (?:partisan|ranseur|spetum|glaive|halberd|bardiche|voulge|fauchard|guisarme|bill-guisarme|lucern hammer|bec de corbin)/], ['hammer received', /\b[a-zA-Z] - an? (?:uncursed )?[+-]\d+ war hammer/]],
    'explore-mode-entry': [['mode changed', /You are now in non-scoring explore mode/], ['repeated entry acknowledged', /You are already in explore mode/]],
    'long-worm-cutting': [['worm cut', /You cut (?:part of the tail off of the long worm|the long worm in half)/]],
    'shirt-armor-destruction': [['scroll revealed', /This is a scroll of destroy armor/], ['shirt destroyed', /Your shirt crumbles into tiny threads/]],
    'floor-glob-melding': [['globs meld', /globs? (?:of gray ooze )?(?:coalesce|meld)|glob of gray ooze (?:coalesces|melds)/]],
    'rider-corpse-revival': [['Rider revives', /Death (?:rises|resurrects)|Death moves again/]],
    'leashed-pet-distress': [['pet whimpers', /giant rat squeals/]],
    'buried-object-probing': [['buried cargo displayed', /Things that are buried here/], ['cargo revealed', /^[ \t]*[a-z] - an? (?:uncursed )?diamond named buried cargo/m]],
    'empty-hand-mime': [['drop mimed', /You mime dropping something/]],
    'traditional-item-drop': [['weapon dropped', /You drop .+quarterstaff/]],
    'container-probing': [['contents displayed', /Contents of an? (?:uncursed )?sack/], ['cargo seen', /^[ \t]*[a-z] - an? (?:uncursed )?diamond named probe cargo/m]],
    'shop-wall-litter-repair': [['wall repaired', /Suddenly, a section of the wall closes up/], ['repair cargo dropped', /You drop .+named repair cargo/]],
    'shop-pick-reprimand': [['pick reprimand', /You sneaky (?:cad|minx|beast|fiend)!/]],
    'monster-fire-horn': [['horn played', /(?:ogre|troll) plays .+horn directed at/]],
    'monster-slime-fire-trap': [['monster seeks fire', /(?:ogre|troll) starts turning/], ['slime treated with fire', /(?:ogre|troll)(?:'s slime is burned away| is killed by the fire)/]],
    'shop-consumed-oil-rejection': [['used oil debt blocks purchase', /(?:Please pay|Pay) for the other potions?(?: of oil)? before buying/]],
    'monster-lizard-cure': [['lizard eaten', /(?:ogre|troll) eats .+lizard corpse|You hear chewing/], ['petrification threatens the monster', /(?:limber|slowing down)/]],
    'boulder-teleport-push': [['boulder teleported', /You push the boulder and suddenly it disappears/]],
    'command-help-menus': [['key help displayed', /Depending upon hardware/], ['extended commands displayed', /[Ee]xtended commands/]],
};

export const ROUND23_RECIPES: Record<string, Recipe> = {
    'plenty-horn-meals': recipe('plenty-horn-meals', 'Produce food and drink from a horn of plenty.', [
        ...room(), ...wish('blessed horn of plenty (0:30)'), identify(),
        ...Array.from({ length: 30 }, () => [choose('horn of plenty', 'a*')]).flat(),
    ]),
    'tree-fruit-kicking': recipe('tree-fruit-kicking', 'Kick fresh trees until fruit falls from their branches.', [
        ...room(),
        ...Array.from({ length: 5 }, () => [
            keys('ml'), ...wish('tree'), keys('mh'),
            ...Array.from({ length: 10 }, () => [keys('\x04'), answer('In what direction?', 'l')]).flat(),
            keys('ml'), keys(';.'), keys('\x1b'), ...wish('floor'), keys('mh'),
        ]).flat(),
    ]),
    'peaceful-hat-greeting': greeting('peaceful-hat-greeting', 'peaceful'),
    'hostile-hat-greeting': greeting('hostile-hat-greeting', 'hostile'),
    'leprechaun-gold-theft': recipe('leprechaun-gold-theft', 'Steal a wealthy monster\'s gold in leprechaun form.', [
        ...room(), keys('w-D'), answer('Drop what type of items?', 'a\r'),
        answer('What would you like to drop?', ',\r'), ...polyself('leprechaun'),
        ...Array.from({ length: 8 }, () => [...create('hostile sleeping leprechaun'), ...fight(16)]).flat(),
        keys('I$\x1b'),
    ]),
    'identify-scroll-menu': recipe('identify-scroll-menu', 'Choose an unidentified weapon after reading an identify scroll.', [
        ...room(), ...wish('uncursed +2 dagger named study target', 'uncursed +1 spear', 'uncursed +1 axe', 'uncursed scroll of identify named identification'),
        choose('named identification', 'r*'), choose('named study target', ''), keys('\r\x1b'), keys('i\x1b'),
    ], ['menustyle:full']),
    'engraving-listing': recipe('engraving-listing', 'Write an engraving and list remembered engravings.', [
        ...room(), keys('E-'), answer('What do you want to write in the dust here?', 'A patient adventurer\r'),
        ...wait(3), keys('/e\x1b/E\x1b'),
    ]),
    'weapon-skill-wishes': recipe('weapon-skill-wishes', 'Wish for a weapon selected by its native skill category.', [
        ...room(), ...wish('uncursed polearm named polearm choice', 'uncursed hammer named hammer choice'), identify(), keys('i\x1b'),
    ]),
    'explore-mode-entry': recipe('explore-mode-entry', 'Leave debug mode for explore mode and request it again.', [
        keys('#exploremode\r'), answer('Do you want to enter explore mode?', 'y'), keys('#exploremode\r'),
    ]),
    'long-worm-cutting': recipe('long-worm-cutting', 'Detect a long worm and cut its tail with a blade.', [
        ...room(), ...wish('uncursed +0 long sword', 'blessed potion of monster detection'), identify(), choose('long sword', 'w*'),
        ...create('hostile long worm'), choose('potion of monster detection', 'q*'), keys('\x1b'),
        ...Array.from({ length: 5 }, () => [
            ...create('hostile long worm'),
            ...Array.from({ length: 4 }, () => [keys('mlmlmjmjmhmhmkmk'), ...fight(8)]).flat(),
            ...clearMonsters(),
        ]).flat(),
    ]),
    'boulder-teleport-push': recipe('boulder-teleport-push', 'Push a boulder into a teleport trap.', [
        ...room(30), ...wait(30), keys('mlml'), ...wish('teleportation trap'), keys('mh'), ...wish('boulder'), keys('mh'),
        keys('l'), answer('Really', 'y'),
    ]),
    'command-help-menus': recipe('command-help-menus', 'Read key notation help and the extended command list.', [
        keys('&'), answer('What command?', '&'), keys('\x1b'), choose('List of extended commands', '?'), keys('\x1b'),
    ]),
    'monster-slime-fire-trap': recipe('monster-slime-fire-trap', 'Slime an ogre beside a fire trap it can use to burn the slime away.', [
        ...room(), keys('ml'), ...wish('fire trap'), keys('mh'), ...intrinsic('conflict', 5000),
        ...Array.from({ length: 8 }, () => [
            ...clearMonsters(), ...create('hostile green slime'), ...create('3 peaceful ogre'), ...wait(25),
        ]).flat(),
    ]),
    'monster-lizard-cure': recipe('monster-lizard-cure', 'Let ogres collect lizard corpses before striking them with a cockatrice corpse.', [
        ...room(), ...intrinsic('invisible', 40),
        ...['mh', 'mk', 'ml', 'ml', 'mj', 'mj', 'mh', 'mh'].flatMap(step => [
            ...wish('uncursed lizard corpse'), identify(), choose('lizard corpse', 'd*'), keys(step),
        ]), keys('mkml'), ...create('8 hostile ogre'), ...wait(30),
        ...wish('uncursed leather gloves'), identify(), choose('leather gloves', 'W*'),
        ...wish('uncursed cockatrice corpse'), identify(), choose('cockatrice corpse', 'w*'), ...fight(96),
    ]),
    'shop-consumed-oil-rejection': recipe('shop-consumed-oil-rejection', 'Try to buy remaining oil before paying for a consumed potion.', [
        ...room(), ...lightingShop(), ...wish('10000 gold pieces',
            'uncursed potion of oil named billed oil', 'uncursed potion of oil named billed oil', 'uncursed potion of oil named billed oil'),
        identify(), choose('named billed oil', 'd*'), answer('Izchak offers', 'y'),
        choose('named billed oil', 'm,'), keys('\r'), choose('named billed oil', 'q*'),
        keys('_'), choose('Izchak', 'm'), keys('.'), keys('p'), answer('Pay whom?', '\x1b'),
        answer('Itemized billing?', 'y'), answer('A potion of oil', 'n'), answer('An uncursed potion of oil', 'n'),
        answer('2 potions of oil', 'y'), answer('2 uncursed potions of oil', 'y'),
    ], ['menustyle:traditional']),
    'leashed-pet-distress': recipe('leashed-pet-distress', 'Pull a leashed rat behind the hero until it squeals.', [
        ...room(), ...wish('uncursed leash', 'uncursed wand of slow monster (0:127)'), identify(), ...create('tame giant rat'),
        ...[...'hykulnjb'.repeat(4)].flatMap(direction => [
            choose('leash', 'a*'), answer('In what direction?', direction),
            choose('wand of slow monster', 'z*'), answer('In what direction?', direction),
        ]), ...Array.from({ length: 6 }, () => [keys('mhmhmhmhmlmlmlml')]).flat(),
    ]),
    'buried-object-probing': recipe('buried-object-probing', 'Fill a pit over cargo and probe the buried objects.', [
        ...room(), keys('ml'), ...wish('uncursed diamond named buried cargo', 'uncursed wand of probing'), identify(),
        choose('named buried cargo', 'd*'), ...wish('pit trap', 'boulder'), choose('wand of probing', 'z*'), answer('In what direction?', '>'), keys('\x1b'),
    ]),
    'floor-glob-melding': recipe('floor-glob-melding', 'Drop separate globs together and observe them meld.', [
        ...room(), ...wish('uncursed glob of gray ooze'), identify(), choose('glob of gray ooze', 'd*'),
        ...wish('uncursed glob of gray ooze'), identify(), choose('glob of gray ooze', 'd*'), keys(':'),
    ]),
    'rider-corpse-revival': recipe('rider-corpse-revival', "Drop Death's corpse and wait for its revival.", [
        ...room(), ...wish('Death corpse'), ...wait(30),
    ]),
    'empty-hand-mime': recipe('empty-hand-mime', 'Choose empty hands for dropping an object.', [
        ...room(), keys('d'), answer('What do you want to drop?', '-'),
    ]),
    'traditional-item-drop': recipe('traditional-item-drop', 'Drop possessions through the traditional category prompt.', [
        ...room(), keys('w-D'), answer('What kinds of thing do you want to drop?', 'a\r'),
    ], ['menustyle:traditional']),
    'container-probing': recipe('container-probing', 'Probe a filled sack on the floor to view its contents.', [
        ...room(), ...wish('uncursed empty sack', 'uncursed diamond named probe cargo', 'uncursed wand of probing'), identify(),
        choose('sack', 'a*'), answer('Your sack', 'i'), choose('Gems/Stones', ''), keys('\r'), choose('named probe cargo', ''), keys('\r'),
        choose('sack', 'd*'), choose('wand of probing', 'z*'), answer('In what direction?', '>'), keys('\x1b'),
    ]),
    'shop-wall-litter-repair': recipe('shop-wall-litter-repair', 'Dig through shop walls and leave cargo for the keeper to scatter during repair.', [
        ...room(), ...lightingShop(), ...wish('10000 gold pieces', 'uncursed wand of digging (0:127)'), identify(),
        keys('_'), choose('Izchak', 'm'), keys('.'),
        ...SHOP_WALL_DIRECTIONS.flatMap(([direction, back]) => [
            choose('wand of digging', 'z*'), answer('In what direction?', direction),
            answer('"Cad!', 'y'), answer('"Minx!', 'y'), answer('"Beast!', 'y'), answer('"Fiend!', 'y'),
            keys(`m${direction}`), ...wish('uncursed diamond named repair cargo'), identify(), choose('named repair cargo', 'd*'),
            answer('Izchak offers', 'y'), keys(`m${back}`), ...wait(12),
        ]),
    ]),
    'shop-pick-reprimand': recipe('shop-pick-reprimand', 'Retrieve a pick-axe from a sack inside the lighting shop.', [
        ...room(), ...wish('uncursed empty sack', 'uncursed pick-axe named tunneler'), identify(),
        choose('sack', 'a*'), answer('Your sack', 'i'), choose('Tools', ''), keys('\r'), choose('named tunneler', ''), keys('\r'),
        ...lightingShop(), choose('sack', 'a*'), answer('Do what with your sack?', 'o'), choose('named tunneler', ''), keys('\r'),
    ]),
    'monster-fire-horn': recipe('monster-fire-horn', 'Let ogres acquire fire horns and play them in combat.', [
        ...room(), ...Array.from({ length: 3 }, () => [keys('ml'), ...wish('fountain', 'floor')]).flat(), keys('mhmhmh'),
        ...intrinsic('invisible', 40), ...wish('uncursed fire horn (0:20)'), identify(), choose('fire horn', 'd*'),
        ...create('hostile ogre'), keys('\x14'), answer('Where do you want to be teleported?', 'lll.'),
        ...wish('fountain', 'floor', 'uncursed wand of digging'), identify(), choose('wand of digging', 'z*'),
        answer('In what direction?', 'h'), ...wait(70),
    ]),
    'shirt-armor-destruction': recipe('shirt-armor-destruction', 'Wear a shirt and destroy it with a scroll.', [
        ...room(), keys('T'), ...wait(5),
        ...wish('uncursed T-shirt', 'uncursed leather gloves'), identify(), ...wish('blessed scroll of destroy armor named dissolution'),
        choose('T-shirt', 'W*'), choose('leather gloves', 'W*'),
        choose('named dissolution', 'r*'), choose('T-shirt', '*'),
    ]),
};

export function validateRound23Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-23 recipe ${name}`);
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step => step.screen));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length > 1, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: pattern.exec(text)?.[0] ?? '' })),
    ];
}

function recipe(name: string, description: string, actions: SessionAction[], options: string[] = []): Recipe {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`missing effects for ${name}`);
    return { roles: ['wizard'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: effects.map(([check]) => check),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r'), answer('To what experience level', '30\r'), ...actions, keys('\x1b:\x1b'),
        ] }],
    };
}
function greeting(name: string, disposition: string): Recipe {
    return recipe(name, 'Tip a fedora to a nearby humanoid and receive its response.', [
        ...room(), ...wish('uncursed fedora'), identify(), choose('fedora', 'W*'), ...create(`${disposition} gnome`),
        ...[...'hykulnjb'].flatMap(direction => [choose('fedora', '#tip\r*'), answer('At whom?', direction)]),
    ]);
}
function room(phasingTurns = 5000): SessionAction[] {
    const actions = [...wish('blessed +50 gray dragon scale mail', 'uncursed ring of slow digestion'), identify(),
        keys('T'), ...wait(5), choose('gray dragon scale mail', 'W*'), ...wait(5),
        choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l'),
        ...clearMonsters(), ...intrinsic('pass thru walls', phasingTurns), keys('mhmk')];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 2) actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 2) actions.push(keys('mj'));
    }
    actions.push(keys('mhmk'), ...clearMonsters());
    return actions;
}
function lightingShop(): SessionAction[] {
    return [...intrinsic('monster detection', 5000), ...wish('blessed potion of object detection'), identify(),
        choose('minetn', 'm\x16'), choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'), choose('candle', 'o'), keys('.')];
}
function clearMonsters(): SessionAction[] {
    return [...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function intrinsic(property: string, turns: number): SessionAction[] {
    const page = property === 'conflict' ? 2 : property === 'pass thru walls' ? 1 : 0;
    return [keys(`#wizintrinsic\r${' '.repeat(page)}${turns}`), choose(property === 'invisible' ? ' - invisible' : property, ''), keys('\r')];
}
function wish(...items: string[]): SessionAction[] {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster: string): SessionAction[] {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')];
}
function polyself(monster: string): SessionAction[] {
    return [keys('#polyself\r'), answer('Become what kind of monster?', `${monster}\r`)];
}
function fight(turns: number): SessionAction[] {
    return [...'hykulnjb'.repeat(Math.ceil(turns / 8))].flatMap(direction => [
        keys(`F${direction}`), answer('Really attack', 'y'), answer('Call ', '\r'), answer('Die?', 'n'),
    ]);
}
function wait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r'), answer('Die?', 'n')]).flat();
}
function identify(): SessionAction { return keys('\t\t\r'); }
function choose(target: string, openKeys: string): SessionAction { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt: string, value: string): SessionAction { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value: string): SessionAction { return { type: 'keys', value, dismissMore: true }; }
