import type { SessionAction } from '../lib/session-types.mjs';
import type { Character, Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];

const EFFECTS: Record<string, readonly Effect[]> = {
    'rapid-artifact-invocation': [['invocation paid with energy', /You feel drained/]],
    'speaking-trap-key': [['artifact speaks', /Key of Thievery whispers/], ['hidden trap sensed', /The Key feels (?:slightly warm|warm|very warm|hot)/]],
    'ahriman-levitation': [['levitation begins', /You (?:start to float|float up)/], ['levitation ends', /You float gently to the/]],
    'mundane-reading': [['shirt or apron read', /It reads:/], ['shirt design examined', /The design features/], ['wrapper read', /wrapper/]],
    'blank-scroll-reading': [['blank paper recognized', /This scroll seems to be blank/]],
    'cursed-armor-disintegration': [['cursed armor destroyed', /(?:shoes|boots) disintegrate/]],
    'confused-armor-proofing': [['armor glows purple', /(?:glows?|glowing) purple/]],
    'cloud-target-highlighting': [['cloud harms hero', /You cough|coughing/]],
    'statue-fracturing': [['statue becomes rocks', /(?:statue shatters|statue crumbles|rocks)/]],
    'corpse-wand-revival': [['corpse revives', /(?:corpse comes (?:back )?(?:to life|alive)|corpse resurrects|lizard is resurrected|lizard comes alive)/]],
    'spell-list-sorting': [['sort picker displayed', /View known spells list sorted/], ['known spells displayed', /Currently known spells/]],
    'magical-detection': [['food detected', /(?:sense.*food|nose.*tingle|sense.*lack of food|smell.*food)/], ['furniture revealed', /staircase down/], ['trap revealed', /You reveal (?:a trap|\d+ traps)|There is a pit here/]],
    'bell-opening': [['bell opens container', /(?:box opens|box clicks open|box unlocks|Something opens|Things open around)/]],
    'charged-wand-explosion': [['wand snapped', /you (?:snap|break) it in two/], ['magical explosion', /You are caught in the magical blast/]],
    'blind-engraving': [['blind writing read', /You (?:read|feel the words)/]],
    'lamp-exhaustion': [['lantern dims', /Your lantern is getting dim/], ['lamp flickers', /Your (?:oil )?lamp flickers/], ['light burns out', /(?:lamp has gone out|lantern has run out of power|lamp goes out)/]],
    'strangulation-warning': [['strangulation progresses', /(?:find it hard to breathe|gasping for air|can no longer breathe|consciousness is fading|neck is becoming)/]],
    'cursed-figurine': [['figurine transforms', /figurine.*transforms/]],
    'leashed-pet-death': [['pet leashed', /slip the leash around/], ['dogs wiped out', /Wiped out all little dogs/]],
    'leash-removal': [['pet leashed', /slip the leash around/], ['pet released', /remove the leash from|leash falls slack/]],
    'tool-target-highlighting': [['grapple resolves', /You hook yourself!|You are yanked toward the|Nothing happens\./], ['pole rejects adjacent target', /Too close!/]],
    'elemental-artifact-hit': [['fiery blade damages a monster', /The fiery blade (?:burns|hits|vaporizes part of)/]],
    'cursed-wand-backfire': [['cursed wand explodes', /wand of light named faulty \d+ suddenly explodes/]],
    'forgotten-spell-casting': [['forgotten spell backfires', /It invokes nightmarish images in your mind/]],
    'spell-teleportation': [['spell teleport selected', /via spellcast/], ['teleport costs energy or fails to cast', /(?:fail to cast|Where do you want to be teleported)/]],
    'boomerang-flight': [['returning boomerang caught or hits hero', /(?:skillfully catch the boomerang|hit by a boomerang)/]],
    'unicorn-gift': [['unicorn accepts gem', /unicorn (?:gratefully|hesitatingly|graciously) accepts your gift/]],
    'automatic-quiver': [['ammunition readied', /(?:in quiver|at the ready)/]],
    'deadbook-pacification': [['undead pacified', /human zombie (?:turns to flee|seems quite friendly)|peaceful human zombie/]],
    'natural-ice-thaw': [['water freezes', /(?:water freezes|water is frozen)/], ['ice melts or remains frozen', /Some ice melts away|There is ice here/]],
    'jump-from-pit': [['hero jumps out', /You leap from the pit/]],
    'opening-held-hero': [['opening releases grip', /You are released (?:by|from)/]],
    'found-quest-artifact': [['artifact recovered', /Eye of the Aethiopica/]],
    'controlled-artifact-descent': [['hero lands', /You float gently to the/]],
    'scroll-discovery': [['unknown charging scroll learned', /This is a charging scroll/], ['wand recharged', /wand of light glows/]],
    'divine-spell-teaching': [['spell learned directly', /Divine knowledge of .+ fills your mind|knowledge of spell '.+' - .+ is (?:restored|refreshed)/]],
};

export const ROUND15_RECIPES: Record<string, Recipe> = {
    'rapid-artifact-invocation': recipe('rapid-artifact-invocation', 'Invoke Grimtooth twice before its power recovers.', [
        ...wish('uncursed Grimtooth'), identify(),
        ...Array.from({ length: 2 }, () => [choose('Grimtooth', '#invoke\r*'), answer('In what direction?', '>')]).flat(),
    ], ['rogue']),
    'speaking-trap-key': recipe('speaking-trap-key', 'Wield the speaking Master Key beside a trapped chest.', [
        ...wish('blessed Master Key of Thievery', 'uncursed trapped chest'), identify(),
        choose('chest', 'd*'), choose('Master Key', 'w*'), keys('m.'),
    ], ['rogue']),
    'ahriman-levitation': recipe('ahriman-levitation', 'Invoke the Heart of Ahriman and drop it while floating.', [
        ...wish('uncursed Heart of Ahriman'), identify(), choose('Heart of Ahriman', '#invoke\r*'),
        choose('Heart of Ahriman', 'd*'),
    ], ['barbarian']),
    'mundane-reading': recipe('mundane-reading', 'Read clothing and a candy wrapper.', [
        ...wish('uncursed T-shirt', 'uncursed alchemy smock', 'uncursed Hawaiian shirt', 'uncursed candy bar'),
        identify(), ...['T-shirt', 'alchemy smock', 'Hawaiian shirt', 'candy bar'].map(item => choose(item, 'r*')),
    ]),
    'blank-scroll-reading': recipe('blank-scroll-reading', 'Read blank paper without consuming it.', [
        ...wish('uncursed scroll of blank paper'), identify(), choose('scroll of blank paper', 'r*'),
    ]),
    'cursed-armor-disintegration': recipe('cursed-armor-disintegration', 'Destroy the only worn cursed armor with blessed destroy armor.', [
        keys('T'), keys('m.'.repeat(3)),
        ...wish('cursed low boots', 'blessed scroll of destroy armor'), identify(),
        choose('low boots', 'W*'), keys('m.'.repeat(3)), choose('scroll of destroy armor', 'r*'),
    ], ['wizard']),
    'confused-armor-proofing': recipe('confused-armor-proofing', 'Read cursed destroy armor while confused to proof worn armor.', [
        ...wish('uncursed potion of confusion', 'cursed scroll of destroy armor'), identify(),
        choose('of confusion', 'q*'), choose('scroll of destroy armor', 'r*'),
    ]),
    'cloud-target-highlighting': recipe('cloud-target-highlighting', 'Mark valid cloud centers, then create a cloud over the hero.', [
        ...wish('uncursed scroll of stinking cloud'), identify(), choose('scroll of stinking cloud', 'r*'),
        answer('(For instructions type', '$$$.'), keys('m.'.repeat(3)),
    ]),
    'statue-fracturing': recipe('statue-fracturing', 'Strike a floor statue and examine the resulting rocks.', [
        ...wish('uncursed empty statue of a lizard', 'uncursed wand of striking'), identify(),
        choose('statue of a lizard', 'd*'), ...zap('striking', '>'), keys(':'),
    ]),
    'corpse-wand-revival': recipe('corpse-wand-revival', 'Revive a floor corpse with undead turning.', [
        ...wish('uncursed lizard corpse', 'uncursed wand of undead turning'), identify(),
        choose('lizard corpse', 'd*'), ...zap('undead turning', '>'),
    ]),
    'spell-list-sorting': recipe('spell-list-sorting', 'Sort the known spell list by name and by descending level.', [
        keys('#showspells\r'), answer('Currently known spells', '+'), choose('alphabetically', ''),
        answer('Currently known spells', '+'), choose('by level, high to low', ''), keys('\x1b'),
    ], ['wizard']),
    'magical-detection': recipe('magical-detection', 'Detect food, furniture, a vicinity map and a nearby trap.', [
        ...wish('uncursed food ration'), identify(), choose('food ration', 'd*'), keys('mlml'),
        choose('detect food', '#wizcast\r'), keys('\x1b'),
        ...wish('blessed crystal ball (0:5)'), identify(), choose('crystal ball', 'a*'),
        answer('What do you look for?', '_'), answer('You peer into', '>.'), keys('m.'.repeat(10)),
        choose('clairvoyance', '#wizcast\r'), keys('\x1b'),
        ...wish('fountain', 'floor', 'pit', 'uncursed wand of secret door detection', 'cursed scroll of gold detection'),
        identify(), choose('wand of secret door detection', 'z*'),
        choose('scroll of gold detection', 'r*'), keys('\x1b'),
    ]),
    'bell-opening': recipe('bell-opening', 'Ring the Bell of Opening beside a locked box.', [
        ...wish('uncursed locked large box', 'blessed Bell of Opening'), identify(),
        choose('large box', 'd*'), choose('Bell of Opening', 'a*'), keys(':'),
    ]),
    'charged-wand-explosion': recipe('charged-wand-explosion', 'Break a charged magic missile wand and endure its blast.', [
        ...wish('uncursed gauntlets of power', 'uncursed wand of magic missile (0:1)'), identify(), choose('gauntlets of power', 'W*'), keys('m.'.repeat(3)), choose('wand of magic missile', 'a*'),
        answer('Are you really sure', 'y'),
    ]),
    'blind-engraving': recipe('blind-engraving', 'Write while blind, feel an inscription, and teleport it away.', [
        ...wish('uncursed blindfold', 'uncursed wand of fire', 'uncursed wand of polymorph', 'uncursed wand of teleportation'), identify(),
        choose('blindfold', 'P*'), keys('E'), answer('What do you want to write with?', '-'),
        answer('What do you want to write', 'Careful steps\r'), keys(':'),
        keys('R'), choose('wand of fire', 'E*'),
        answer('Do you want to add', 'n'), answer('What do you want to burn', 'Deep words\r'),
        choose('blindfold', 'P*'), choose('wand of polymorph', 'E*'), keys(':'), keys('R'),
        choose('wand of teleportation', 'E*'), keys(':'),
    ]),
    'lamp-exhaustion': recipe('lamp-exhaustion', 'Burn a lantern and an oil lamp until their fuel runs out.', [
        ...wish('uncursed brass lantern', 'uncursed oil lamp', 'uncursed ring of slow digestion', 'blessed +50 gray dragon scale mail'),
        identify(), keys('T'), keys('m.'.repeat(3)), choose('gray dragon scale mail', 'W*'), keys('m.'.repeat(5)),
        choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l'),
        ...stoneShelter(), choose('brass lantern', 'a*'), choose('oil lamp', 'a*'), ...wait(1600),
    ], ['wizard']),
    'strangulation-warning': recipe('strangulation-warning', 'Wear an amulet of strangulation briefly, then remove it.', [
        ...wish('uncursed amulet of strangulation'), identify(), choose('amulet of strangulation', 'P*'),
        keys('m.'.repeat(3)), keys('R'),
    ]),
    'cursed-figurine': recipe('cursed-figurine', 'Start a cursed figurine timer and deliberately transform the figurine.', [
        ...wish('cursed figurine of a little dog'), identify(), choose('figurine', 'a*'), answer('In what direction?', '.'),
    ]),
    'leashed-pet-death': recipe('leashed-pet-death', 'Release a pet leash when its canine owner dies.', [
        ...leashPetRepeatedly(), answer('Call ', '\r'), ...wish('blessed scroll of genocide'), identify(),
        choose('of genocide', 'r*'), answer('What class of monsters', 'd\r'),
    ]),
    'leash-removal': recipe('leash-removal', 'Attach and remove a pet leash, then eat the leash in cube form.', [
        ...leashPetRepeatedly(),
        keys('#polyself\r'), answer('Become what kind of monster?', 'gelatinous cube\r'), choose('leash', 'me*'),
    ]),
    'tool-target-highlighting': recipe('tool-target-highlighting', 'Mark valid grappling and polearm targets before using each tool.', [
        ...wish('uncursed grappling hook', 'uncursed halberd'), identify(), choose('grappling hook', 'a*'),
        answer('(For instructions type', '$$$.'), choose('halberd', 'a*'),
        answer('(For instructions type', '$$$.'),
    ]),
    'elemental-artifact-hit': recipe('elemental-artifact-hit', 'Strike sleeping ogres with Fire Brand.', [
        ...wish('blessed +5 Fire Brand'), identify(), choose('Fire Brand', 'w*'),
        ...create('8 hostile sleeping ogre'),
        ...[...'hykulnjbhykulnjb'].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y')]),
    ]),
    'cursed-wand-backfire': recipe('cursed-wand-backfire', 'Zap cursed wands until one backfires.', [
        ...stoneShelter(),
        ...Array.from({ length: 4 }, (_, index) => [
            ...wish(`cursed wand of light (0:127) named faulty ${index}`), identify(),
            choose(`faulty ${index}`, '#adjust\r*'), answer('Adjust letter to what', 'Z'),
            ...Array.from({ length: 127 }, () => [keys('z'), answer('What do you want to zap?', 'Z'), keys('\x1b')]).flat(),
        ]).flat(),
    ], ['wizard']),
    'forgotten-spell-casting': recipe('forgotten-spell-casting', 'Lose spell knowledge to amnesia and try the forgotten spell.', [
        ...wish('8 cursed scrolls of amnesia named amnesia'), identify(),
        ...Array.from({ length: 8 }, () => [choose('amnesia', 'r*')]).flat(),
        choose('force bolt', 'Z*'), answer('In what direction?', '>'),
    ], ['wizard']),
    'spell-teleportation': recipe('spell-teleportation', 'Use the wizard teleport menu to cast a temporary teleport spell.', [
        ...Array.from({ length: 6 }, () => [choose('via spellcast', 'm\x14'),
            answer('Where do you want to be teleported?', 'l.')]).flat(),
        keys('#showspells\r\x1b'),
    ], ['wizard']),
    'boomerang-flight': recipe('boomerang-flight', 'Throw boomerangs along each curved flight path.', [
        ...openPracticeRoom(),
        ...[...'hykulnjb'].flatMap(direction => [
            ...wish('uncursed boomerang'), identify(), choose('boomerang', 't*'), answer('In what direction?', direction),
        ]),
    ]),
    'unicorn-gift': recipe('unicorn-gift', 'Offer identified diamonds to awake gray unicorns.', [
        ...openPracticeRoom(),
        ...create('8 hostile gray unicorn'),
        ...[...'hykulnjb'].flatMap(direction => [
            ...wish('uncursed diamond'), identify(), choose('diamond', 't*'), answer('In what direction?', direction),
        ]),
    ]),
    'automatic-quiver': { ...recipe('automatic-quiver', 'Fire darts without first choosing a quiver.', [
        ...wish('10 uncursed darts'), identify(), keys('Q'), answer('What do you want to ready?', '-'), keys('f'), answer('In what direction?', 'l'), keys('i\x1b'),
    ]), options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'autoquiver'] },
    'deadbook-pacification': recipe('deadbook-pacification', 'Read the blessed Book of the Dead near hostile undead.', [
        ...wish('blessed Book of the Dead'), identify(), ...create('8 hostile sleeping human zombie'),
        choose('Book of the Dead', 'r*'),
        ...Array.from({ length: 8 }, (_, index) => [keys(';'),
            answer('Pick a monster', 'm'.repeat(index + 1) + '.'),
            answer('(For instructions type', 'm'.repeat(index + 1) + '.')]).flat(),
    ]),
    'natural-ice-thaw': recipe('natural-ice-thaw', 'Freeze a pool and wait for its ice timer; then melt ice with fire.', [
        ...wish('blessed +99 gray dragon scale mail'), identify(), keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'), keys('m.'.repeat(5)),
        ...wish('uncursed ring of slow digestion', 'uncursed ring of levitation'), identify(), choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l'), choose('ring of levitation', 'P*'), answer('Which ring-finger', 'r'), ...stoneShelter(),
        ...wish('pool', 'uncursed wand of cold (0:8)', 'uncursed wand of fire (0:8)'), identify(),
        ...zap('cold', '>'), ...wait(2005), keys(':'),
        ...wish('pool'), ...zap('cold', '>'), ...zap('fire', '>'), keys(':'),
    ], ['wizard']),
    'jump-from-pit': recipe('jump-from-pit', 'Jump out of a pit and land on the adjacent floor.', [
        ...openPracticeRoom(), ...wish('pit'), keys('mlmh'), choose('jumping', '#wizcast\r'),
        answer('Where do you want to jump?', 'l.'), answer('(For instructions type', 'l.'), keys(':'),
    ], ['wizard']),
    'opening-held-hero': recipe('opening-held-hero', 'Release a giant mimic grip with a self-directed opening wand.', [
        ...openPracticeRoom(), ...wish('uncursed wand of opening (0:127)'), identify(),
        ...create('8 hostile giant mimic'),
        ...[...'hykulnjb'].map(direction => keys(`F${direction}`)),
        ...Array.from({ length: 20 }, () => [keys('m.'), ...zap('opening', '.'), ...wish('blessed potion of full healing'), identify(), choose('of full healing', 'q*')]).flat(),
    ], ['wizard']),
    'found-quest-artifact': recipe('found-quest-artifact', 'Find the quest artifact on its native quest altar.', [
        ...wish('blessed scroll of genocide'), identify(), choose('Wiz-goal', 'm\x16'),
        choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
        keys('#wizmap\r\x14'), answer('Where do you want to be teleported?', '_.'), answer('(For instructions type', '_.'),
        keys(':,'), answer('Pick up what?', ',\r'), keys('i\x1b'),
    ], ['wizard']),
    'controlled-artifact-descent': recipe('controlled-artifact-descent', 'End invoked artifact levitation with the descend command.', [
        ...wish('uncursed Heart of Ahriman'), identify(), choose('Heart of Ahriman', '#invoke\r*'), keys('>'),
    ], ['barbarian']),
    'scroll-discovery': recipe('scroll-discovery', 'Discover an unknown charging scroll by recharging an empty wand.', [
        ...wish('uncursed wand of light (0:0)'), identify(), ...wish('blessed scroll of charging named lesson'),
        choose('lesson', 'r*'), choose('wand of light', '*'),
    ]),
    'divine-spell-teaching': recipe('divine-spell-teaching', 'Earn favor at a co-aligned altar, then receive direct divine spell teaching.', character => [
        ...quietInvulnerableHero(), ...openPracticeRoom(), ...wish('blessed +5 Fire Brand'), identify(), choose('Fire Brand', 'w*'),
        ...create('8 hostile sleeping ogre'), ...[...'hykulnjbhykulnjb'].flatMap(direction => [keys(`F${direction}`), answer('Call ', '\r')]),
        ...stoneShelter(), ...wish(`${character.align} altar`, 'blessed luckstone', '48 uncursed wraith corpses'), identify(),
        ...Array.from({ length: 48 }, () => [
            keys('#offer\r'), ...Array.from({ length: 8 }, () => answer('There ', 'n')), choose('wraith corpse', '*'),
            answer('Gift an artifact?', 'n'),
        ]).flat(),
        ...Array.from({ length: 128 }, () => [keys('#pray\r'), answer('Are you sure you want to pray?', 'y'),
            answer('Force the gods to be pleased?', 'y'), keys('m.'.repeat(3))]).flat(),
    ], ['wizard']),
};

export function validateRound15Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-15 recipe ${name}`);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}

function recipe(name: string, description: string, actions: SessionAction[] | ((character: Character) => SessionAction[]), roles = ['wizard', 'rogue', 'barbarian']): Recipe {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-15 recipe ${name}`);
    return {
        roles,
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'],
        description,
        success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc, character }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r'), answer('To what experience level', '20\r'),
            ...(typeof actions === 'function' ? actions(character) : actions), keys('\x1b:\x1b'),
        ] }],
    };
}

function wait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r')]).flat();
}

function wish(...items: string[]): SessionAction[] {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}

function leashPetRepeatedly(): SessionAction[] {
    return [
        ...wish('blessed +99 gray dragon scale mail'), identify(), keys('T'), keys('m.'.repeat(5)),
        choose('gray dragon scale mail', 'W*'), keys('m.'.repeat(5)),
        ...wish('uncursed leash', 'uncursed magic whistle'), identify(), ...create('tame sleeping little dog'),
        ...[...'hykulnjb'.repeat(8)].flatMap(direction => [answer('Call ', '\r'), choose('magic whistle', 'a*'), answer('Call ', '\r'), choose('leash', 'a*'), answer('In what direction?', direction)]),
    ];
}

function quietInvulnerableHero(): SessionAction[] {
    return [keys('#wizintrinsic\r10000'), choose('invulnerable', ''), keys('\r'),
        keys('#wizintrinsic\r10000'), choose('deafness', ''), keys('\r')];
}

function openPracticeRoom(): SessionAction[] {
    const actions = [...wish('blessed +50 gray dragon scale mail'), identify(), keys('T'), keys('m.'.repeat(3)),
        choose('gray dragon scale mail', 'W*'), keys('m.'.repeat(5)),
        keys('#wizintrinsic\r 10000'), choose('pass thru walls', ''), keys('\r'), keys('mh'.repeat(80) + 'mk'.repeat(21) + 'ml'.repeat(5) + 'mj'.repeat(5))];
    for (let row = 0; row < 7; row++) {
        for (let column = 0; column < 7; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 6) actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 6) actions.push(keys('mj'));
    }
    actions.push(keys('mh'.repeat(3) + 'mk'.repeat(3)));
    return actions;
}

function stoneShelter(): SessionAction[] {
    return [keys('#wizintrinsic\r 10000'), choose('pass thru walls', ''), keys('\r'),
        ...[...'ljhhkkll'].flatMap(direction => [keys(`m${direction}`), ...wish('wall')]), keys('mb')];
}

function create(monster: string): SessionAction[] {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`)];
}

function zap(wand: string, direction: string): SessionAction[] {
    return [choose(`wand of ${wand}`, 'z*'), answer('In what direction?', direction)];
}

function identify(): SessionAction {
    return keys('\t\t\r');
}

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function answer(prompt: string, value: string): SessionAction {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}

function keys(value: string): SessionAction {
    return { type: 'keys', value, dismissMore: true };
}
