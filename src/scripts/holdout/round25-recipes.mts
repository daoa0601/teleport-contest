import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];
const EFFECTS: Record<string, readonly Effect[]> = {
    'wishing-wand-recharge': [['wand charged', /wand of wishing glows feebly blue/], ['overcharged wand destroyed', /wand of wishing vibrates violently and explodes/]],
    'cursed-wand-discharge': [['charges stripped', /wand of light vibrates briefly/]],
    'burning-oil-impact': [['oil lit', /light your potion/], ['oil splattered', /caught in the burning oil/]],
    'novel-cancellation': [['novel cancelled', /(?:spellbook of blank paper|plain spellbook)/]],
    'reverse-potion-dip': [['reverse dip prompted', /What do you want to dip into the potion of water/], ['weapon wetted', /Your dagger rusts/]],
    'queen-bee-egg': [['egg laid', /You lay an egg/], ['egg inspected', /(?:killer|queen) bee egg/]],
    'vampire-monster-shift': [['vampire shifted', /You transform into (?:a fog cloud|a vampire bat|a wolf|a vampire)/]],
    'nymph-chain-removal': [['punishment removed', /You are not chained to anything/]],
    'lamp-wish-granted': [['djinni freed', /djinni emerges/], ['wish granted', /I will grant one wish/]],
    'sunsword-light-scroll': [['artifact lit', /Sunsword begins to shine/], ['light blessing', /Sunsword glows (?:with )?(?:a )?(?:amber|light blue)/]],
    'sink-pipes-break': [['sink broken', /pipes break!\s+Water spurts out/]],
    'wish-history-selection': [['wish history offered', /Wish what\?/], ['previous wish repeated', /2.*named history gem/]],
    'throne-gold-confiscation': [['gold taken', /You notice you have no gold/]],
    'gremlin-water-division': [['hero divided', /You multiply/]],
    'storm-target-highlighting': [['spell aimed', /Where do you want to cast the spell/], ['storm hit hero', /caught in the fireball/], ['valid positions marked', /\${3}/]],
    'minetown-shop-conversation': [['keeper answered', /Izchak (?:says|mentions|talks|reminds|encourages|warns|complains|informs|advises|asks|recommends|indicates|comments)|shoplifters|shopkeeping/]],
    'shop-floor-dig-warning': [['keeper warned', /do not damage the floor here|might fall through the floor/]],
    'temple-priest-attack': [['temple entered', /(?:sacred|desecrated) place|pilgrim|Pilgrim/], ['divine retaliation', /Thou shalt suffer|How darest thou harm my servant|Thou dost profane my shrine/]],
    'temple-human-sacrifice': [['altar desecrated', /altar is stained with human blood|blood floods the altar|blood covers the altar/]],
    'fake-amulet-offering': [['fake exposed', /nearby thunderclap/]],
    'nemesis-death-cloud': [['nemesis killed', /(?:kill|destroy) the Chromatic Dragon/], ['gas created', /(?:noxious|poisonous|toxic) (?:gas|fumes)|gas cloud/]],
    'figurine-timer-transformation': [['figurine animated', /figurine transform into|out of your pack/]],

    'shop-resident-restore': [['shop entered', /Welcome to Izchak/], ['game saved', /Be seeing you/], ['game restored', /welcome back to NetHack/i]],
    'temple-priest-restore': [['temple entered', /enter a sacred place|desecrated place/], ['game saved', /Be seeing you/], ['game restored', /welcome back to NetHack/i]],
    'controlled-vampire-shape': [['form chosen', /into what.*vampire bat/], ['vampire changed', /(?:turns into a vampire bat|vampire bat appears|vampire bat,)/]],
    'wizard-first-death': [['Wizard killed', /(?:kill|destroy) the Wizard of Yendor/]],
    'polearm-fire-target': [['polearm hit', /(?:hit|smite|kill) the shrieker/]],
};

export const ROUND25_RECIPES: Record<string, Recipe> = {
    'wishing-wand-recharge': recipe('wishing-wand-recharge', 'Charge a wishing wand, then recharge it again until it explodes.', [
        ...prepare(), ...wish('uncursed wand of wishing (0:0)', 'blessed scroll of charging'), identify(),
        choose('of charging', 'r*'), choose('wand of wishing', '*'),
        ...wish('blessed scroll of charging'), identify(), choose('of charging', 'r*'), choose('wand of wishing', '*'),
    ]),
    'cursed-wand-discharge': recipe('cursed-wand-discharge', 'Strip charges with a cursed charging scroll.', [
        ...prepare(), ...wish('uncursed wand of light (0:10)', 'cursed scroll of charging'), identify(),
        choose('of charging', 'r*'), choose('wand of light', '*'),
    ]),
    'burning-oil-impact': recipe('burning-oil-impact', 'Light a potion of oil and throw it at the floor.', [
        ...prepare(), ...wish('uncursed potion of oil'), identify(), choose('potion of oil', 'a*'),
        choose('potion of oil', 't*'), answer('In what direction?', '>'),
    ]),
    'novel-cancellation': recipe('novel-cancellation', 'Cancel a novel and inspect its blank replacement.', [
        ...prepare(), ...wish('uncursed novel named Thud!', 'uncursed wand of cancellation (0:10)'), identify(),
        choose('novel', 'd*'), choose('wand of cancellation', 'z*'), answer('In what direction?', '>'), keys(':\x1b'),
    ]),
    'reverse-potion-dip': recipe('reverse-potion-dip', 'Dip a dagger through the potion inventory action.', [
        ...prepare(), ...wish('uncursed dagger', 'uncursed potion of water'), identify(),
        choose('potion of water', 'i'), choose('Dip', ''), choose('dagger', '*'),
    ]),
    'queen-bee-egg': { genders: ['female'], ...recipe('queen-bee-egg', 'Lay an egg in queen bee form.', [
        ...prepare(), ...polyself('queen bee'), choose('All types', 'D'), choose('Auto-select every relevant item', ''), keys('\rml#sit\r:\x1b'),
    ]) },
    'vampire-monster-shift': recipe('vampire-monster-shift', 'Use the vampire monster ability to change form.', [
        ...prepare(), ...polyself('vampire'), keys('#monster\r'),
    ]),
    'nymph-chain-removal': recipe('nymph-chain-removal', 'Use a nymph ability to remove punishment.', [
        ...prepare(), ...wish('uncursed scroll of punishment'), identify(), choose('of punishment', 'r*'),
        ...polyself('wood nymph'), keys('#monster\r#monster\r'),
    ]),
    'lamp-wish-granted': recipe('lamp-wish-granted', 'Free a wish-granting djinni from a blessed magic lamp.', [
        ...prepare(), ...wish('blessed magic lamp'), identify(),
        ...Array.from({ length: 16 }, () => [choose('lamp', '#rub\r*'), answer('For what do you wish?', 'uncursed diamond\r')]).flat(),
    ]),
    'sunsword-light-scroll': recipe('sunsword-light-scroll', 'Bless wielded Sunsword with a scroll of light.', [
        ...prepare(), ...wish('uncursed Sunsword'), identify(), choose('Sunsword', 'w*'),
        ...Array.from({ length: 16 }, () => [...wish('blessed scroll of light'), identify(), choose('of light', 'r*')]).flat(),
    ]),
    'sink-pipes-break': recipe('sink-pipes-break', 'Dip a dagger under sinks until their pipes break.', [
        ...prepare(), ...wish('uncursed dagger'), identify(),
        ...Array.from({ length: 50 }, () => [...wish('sink'), choose('dagger', '#dip\r*'), answer('Dip ', 'y')]).flat(),
    ]),
    'wish-history-selection': recipe('wish-history-selection', 'Select a previous wish from the wizard wish history.', [
        ...wish('uncursed diamond named history gem'), identify(), choose('named history gem', 'm\x17'), choose('named history gem', 'i'), keys('\x1b'),
    ]),
    'throne-gold-confiscation': recipe('throne-gold-confiscation', 'Let a throne confiscate carried gold.', [
        ...prepare(), ...wish('100 gold pieces'),
        ...Array.from({ length: 16 }, () => [...wish('throne'), keys('#sit\r'), answer('Throne sit effect', '5\r')]).flat(),
    ]),
    'gremlin-water-division': recipe('gremlin-water-division', 'Divide in a fountain in gremlin form.', [
        ...prepare(), ...polyself('gremlin'), ...wish('fountain'), keys('#sit\r'),
    ]),
    'storm-target-highlighting': recipe('storm-target-highlighting', 'Mark valid target squares for an artifact fire storm.', [
        ...prepare(), ...wish('uncursed Fire Brand', 'uncursed ring of fire resistance'), identify(),
        choose('ring of fire resistance', 'P*'), answer('Which ring-finger', 'l'),
        choose('Fire Brand', '#invoke\r*'), answer('Where do you want to cast', '$$$.'),
        answer('(For instructions type', '$$$.'),
    ]),
    'minetown-shop-conversation': recipe('minetown-shop-conversation', 'Chat with the resident Minetown shopkeeper.', [
        ...prepare(), ...wish('uncursed pick-axe'), identify(), ...lightingShop(), ...approachKeeper(), ...intrinsic('blinded'), ...chat(),
    ]),
    'shop-floor-dig-warning': recipe('shop-floor-dig-warning', 'Start digging the floor inside a shop.', [
        ...prepare(), ...wish('uncursed pick-axe'), identify(), ...lightingShop(),
        choose('pick-axe', 'a*'), answer('In what direction', '>'),
    ]),
    'temple-priest-attack': recipe('temple-priest-attack', 'Attack the resident temple priest and receive divine retaliation.', [
        ...prepare(), ...temple(), ...Array.from({ length: 4 }, () => [...fight(), answer('Die?', 'n')]).flat(),
    ]),
    'temple-human-sacrifice': recipe('temple-human-sacrifice', 'Sacrifice a human corpse in a temple and anger its priest.', [
        ...prepare(), ...temple(), ...wish('uncursed human corpse'), keys('#offer\r'), answer('There is ', 'y'), answer('Die?', 'n'),
    ]),
    'fake-amulet-offering': recipe('fake-amulet-offering', 'Offer a known fake Amulet on an altar.', [
        ...prepare(), ...wish('neutral altar', 'uncursed cheap plastic imitation of the Amulet of Yendor'), identify(),
        choose('cheap plastic', '#offer\r*'), answer('Die?', 'n'),
    ]),
    'nemesis-death-cloud': { ...recipe('nemesis-death-cloud', 'Kill the Chromatic Dragon and inspect the resulting gas.', [
        ...prepare(), ...intrinsic('monster detection'), ...create('hostile sleeping Chromatic Dragon'),
        keys('#wizkill\r'), answer('Pick first monster to slay:', 'm.'), keys('\x1b;.\x1b'),
    ]), roles: ['caveman'] },
    'figurine-timer-transformation': recipe('figurine-timer-transformation', 'Wait for carried cursed figurines to animate.', [
        ...prepare(), ...intrinsic('invulnerable'),
        ...wish(...Array.from({ length: 12 }, () => 'cursed figurine of a lichen')), identify(),
        ...Array.from({ length: 1800 }, () => [keys('m.'), answer('Die?', 'n'), answer('Call ', '\r')]).flat(),
    ]),
    'shop-resident-restore': savedRecipe('shop-resident-restore', 'Save in Minetown and restore its resident shopkeeper.', [
        ...prepare(), ...wish('uncursed pick-axe'), identify(), ...lightingShop(),
    ]),
    'temple-priest-restore': savedRecipe('temple-priest-restore', 'Save in a temple and restore its priest.', [
        ...prepare(), ...temple(),
    ]),
    'controlled-vampire-shape': recipe('controlled-vampire-shape', 'Choose a vampire bat form for a vampire.', [
        ...prepare(), choose('monpolycontrol', '#optionsfull\r'), keys('\r\x1b'),
        ...create('peaceful sleeping vampire'), answer('Change ', 'wolf\r'), answer('Change ', 'vampire bat\r'),
        keys(';m.\x1b'),
    ]),
    'wizard-first-death': recipe('wizard-first-death', 'Kill the Wizard of Yendor and activate his harassment timer.', [
        ...prepare(), ...create('hostile sleeping Wizard of Yendor'), keys('#wizkill\r'),
        answer('Pick first monster to slay:', 'm.'), keys('\x1b'),
    ]),
    'polearm-fire-target': recipe('polearm-fire-target', 'Use fire to attack a distant monster with a wielded polearm.', [
        ...room(), ...wish('uncursed halberd', 'uncursed arrow'), identify(), choose('arrow', 'Q*'), choose('halberd', 'w*'),
        ...create('hostile sleeping shrieker'), keys('\x14'), answer('Where do you want to be teleported?', 'mhh.'),
        ...Array.from({ length: 8 }, () => [keys('f'), answer('In what direction?', '\x1b'),
            answer('Where do you want to hit?', 'm.')]).flat(),
    ]),
};

function recipe(name: string, description: string, actions: SessionAction[]): Recipe {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-25 recipe ${name}`);
    return {
        roles: ['wizard'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'],
        description, success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [...actions, keys('\x1b:\x1b')] }],
    };
}

function savedRecipe(name: string, description: string, actions: SessionAction[]): Recipe {
    const base = recipe(name, description, []);
    return { ...base, build: ({ seed, datetime, rc }) => [
        { seed, datetime, nethackrc: rc(), driver: [...actions, keys('S'), answer('Really save?', 'y'),
            { type: 'keys', value: '', dismissMore: true, expectExit: true }] },
        { seed, datetime, nethackrc: rc(), driver: [keys('m.:\x1b')] },
    ] };
}

export function validateRound25Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-25 recipe ${name}`);
    const screens = session.segments.flatMap(segment => segment.steps ?? [])
        .map(step => step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    return [
        { check: 'complete recorded version-5 segments', ok: session.version === 5 && session.segments.length === (name.endsWith('-restore') ? 2 : 1) && session.segments.every(segment => (segment.steps?.length ?? 0) >= 2), evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}

function prepare(): SessionAction[] {
    return [keys('#levelchange\r'), answer('To what experience level', '20\r'),
        ...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
        keys('#wizintrinsic\r 5000'), choose('pass thru walls', ''), keys('\rml'), ...wish('fountain', 'floor')];
}
function room(): SessionAction[] {
    const actions = [...prepare(), keys('mhmhmkmk')];
    for (let row = 0; row < 5; row++) {
        for (let column = 0; column < 5; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 4) actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 4) actions.push(keys('mj'));
    }
    actions.push(keys('mhmhmkmk'));
    return actions;
}

function intrinsic(property: string): SessionAction[] {
    return [keys('#wizintrinsic\r5000'), choose(property, ''), keys('\r')];
}
function create(monster: string): SessionAction[] {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')];
}
function lightingShop(): SessionAction[] {
    return [...intrinsic('monster detection'), ...wish('blessed potion of object detection'), identify(),
        choose('minetn', 'm\x16'), choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'), choose('candle', 'o'), keys('.')];
}
function approachKeeper(): SessionAction[] {
    return [keys('\x14'), choose('Izchak', 'm'), keys('h.')];
}
function temple(): SessionAction[] {
    return [...intrinsic('monster detection'), choose('minetn', 'm\x16'), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!_.')];
}
function chat(): SessionAction[] {
    return [...'hykulnjb'].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction),
        answer('How much will you offer', '\x1b')]);
}
function fight(): SessionAction[] {
    return [...'hykulnjb'].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y')]);
}

function polyself(monster: string): SessionAction[] { return [keys('#polyself\r'), answer('Become what kind of monster?', `${monster}\r`)]; }
function wish(...items: string[]): SessionAction[] { return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]); }
function identify(): SessionAction { return keys('\t\t\r'); }
function choose(target: string, openKeys: string): SessionAction { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt: string, value: string): SessionAction { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value: string): SessionAction { return { type: 'keys', value, dismissMore: true }; }
