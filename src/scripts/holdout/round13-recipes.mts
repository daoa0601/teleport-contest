import type { SessionAction } from '../lib/session-types.mjs';
import type { Character, Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

const EFFECTS: Record<string, readonly [string, RegExp][]> = {
    'vault-owner-name': [['guard arrives', /(?:Vault's guards enters|else has entered the Vault)/],
        ['owner recognized', /Sorry to have disturbed you/]],
    'vault-gold-refusal': [['name requested', /Hello stranger, who are you/],
        ['gold demanded', /drop that gold and follow me/], ['guard angered', /You've been warned, knave!/]],
    'vault-gold-escort': [['name requested', /Hello stranger, who are you/],
        ['gold demanded', /drop that gold and follow me/], ['gold dropped', /You drop [^.\n]*gold pieces/]],
    'castle-bridge-cycle': [['bridge opens', /drawbridge (?:coming|going) down!/],
        ['bridge closes', /drawbridge (?:coming|going) up!/]],
    'castle-bridge-destruction': [['bridge destroyed', /(?:drawbridge collapses|portcullis of the drawbridge falls) into the moat!/]],
    'castle-bridge-occupants': [['bridge opens', /drawbridge (?:coming|going) down!/],
        ['bridge closes', /drawbridge (?:coming|going) up!/], ['object placed', /You drop [^.\n]*(?:ruby|diamond)/],
        ['bridge catches a monster', /ogre (?:is crushed|falls into the moat)/]],
    'successful-pit-rescue': [['monster rescued', /You pull [^.\n]+ out of the pit\./]],
    'quest-guardian-chat': [['guardian answers', /eye of newt|portal (?:worked|spell)|too powerful for us|many evils|Tyvefelle|Twain|cutpurse|hell-hound chow|pieces of glass|enemies' blood|crushing your enemies|horde|Pelias is a strange/]],
    'mind-flayer-grip': [['greased helmet prevents a grab', /cannot hold onto [\s\S]{0,100}greased/]],
    'silver-ring-contact': [['silver ring sears', /Your silver ring sears/]],
    'displaced-shopkeeper-anger': [['shopkeeper angered', /[A-Z][a-z]+ (?:gets angry|is furious)!/]],
};

export const ROUND13_RECIPES: Record<string, Recipe> = {
    'displaced-shopkeeper-anger': recipe('Teleport a Minetown shopkeeper out of the shop.',
        effectsFor('displaced-shopkeeper-anger'), displaceShopkeepers(), { options: ['montelecontrol'] }),
    'vault-owner-name': recipe('Find vault gold and answer the arriving guard with the owner name.',
        effectsFor('vault-owner-name'), vaultVisits('Croesus', false)),
    'vault-gold-refusal': recipe('Keep carried gold after a vault guard orders it dropped.',
        effectsFor('vault-gold-refusal'), vaultVisits('wizard', false)),
    'vault-gold-escort': recipe('Drop carried gold and follow a vault guard into a temporary corridor.',
        effectsFor('vault-gold-escort'), vaultVisits('wizard', true)),
    'castle-bridge-cycle': recipe('Open and close the castle drawbridge with wands.',
        effectsFor('castle-bridge-cycle'), [...castle(), ...zap('opening', 'l'), ...zap('locking', 'l'),
            keys('ml'.repeat(56)), ...zap('opening', 'h'), ...zap('locking', 'h')]),
    'castle-bridge-destruction': recipe('Destroy the raised castle drawbridge with striking.',
        effectsFor('castle-bridge-destruction'), [...castle(), ...zap('striking', 'l'),
            keys('ml'.repeat(56)), ...zap('striking', 'h')]),
    'castle-bridge-occupants': recipe('Close the drawbridge over floor objects and a nearby monster.',
        effectsFor('castle-bridge-occupants'), [...castle(), ...zap('opening', 'l'),
            keys('ml'), ...wish('uncursed flint'), identify(), choose('flint', 'd*'),
            keys('ml'), ...wish('uncursed ruby'), identify(), choose('ruby', 'd*'),
            keys('\x078 sleeping hostile ogre\r'), ...zap('locking', 'h'), ...zap('locking', 'l'),
            choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
            keys('mhmh' + 'ml'.repeat(56)), ...zap('opening', 'h'),
            keys('mhmh'), ...wish('uncursed diamond'), identify(), choose('diamond', 'd*'),
            keys('mh'), ...wish('uncursed luckstone'), identify(), choose('luckstone', 'd*'),
            keys('\x078 sleeping hostile ogre\r'), ...zap('locking', 'h'), ...zap('locking', 'l')]),
    'successful-pit-rescue': recipe('Rescue a trapped ogre through repeated untrapping attempts.',
        effectsFor('successful-pit-rescue'), [keys('#polyself\rxorn\rml'), ...wish('fountain', 'floor', 'pit'),
            keys('mh#polyself\rhuman\r'), ...wish('uncursed gauntlets of power', 'uncursed magic whistle'), identify(),
            choose('gauntlets of power', 'W*'), keys('m.'.repeat(4)), keys('\x07tame ogre\r'),
            ...Array.from({ length: 32 }, () => [choose('magic whistle', 'a*'), ...Array.from({ length: 8 }, () =>
                [keys('#untrap\r'), answer('In what direction?', 'l'), answer('Disarm it?', 'y')]).flat()]).flat()], { protect: false }),
    'quest-guardian-chat': recipe('Ask a role-specific quest guardian for advice.',
        effectsFor('quest-guardian-chat'), character => {
            const guardian = character.role === 'wizard' ? 'apprentice' : character.role === 'rogue' ? 'thug' : 'chieftain';
            return [keys(`\x07peaceful ${guardian}\r`), ...[...'hykulnjb'].flatMap(direction =>
                [keys('#chat\r'), answer('Talk to whom?', direction)])];
        }),
    'mind-flayer-grip': recipe('Let an ogre wear a greased helmet, then try a mind flayer brain attack.',
        effectsFor('mind-flayer-grip'), [...wish('uncursed greased +5 helm of brilliance named slippery',
            'uncursed magic whistle'), identify(), choose('slippery', 'd*'), keys('mh\x07tame ogre\r'),
            ...Array.from({ length: 12 }, () => [choose('magic whistle', 'a*'), keys('m.'.repeat(3))]).flat(),
            keys('#polyself\rmind flayer\r'), ...[...'hykulnjb'.repeat(3)].flatMap(direction =>
                [keys(`F${direction}`), answer('Really attack', 'y')])]),
    'silver-ring-contact': recipe('Touch a silver-hating imp with a silver ring while in mummy form.',
        effectsFor('silver-ring-contact'), [...wish('uncursed silver ring named contact'),
            choose('contact', 'P*'), answer('Which ring-finger', 'r'), keys('#polyself\rhuman mummy\rw-'),
            keys('\x07hostile imp\r'), ...[...'hykulnjbhykulnjb'].flatMap(direction => [keys(`F${direction}`),
                answer('Where do you want to be teleported?', '.')])]),
};

export function validateRound13Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = effectsFor(name);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, effect]) => ({ check, ok: effect.test(text), evidence: '' })),
    ];
}

function recipe(description: string, effects: readonly [string, RegExp][],
    actions: SessionAction[] | ((character: Character) => SessionAction[]),
    { protect = true, options = [] }: { protect?: boolean; options?: string[] } = {}): Recipe {
    return {
        roles: ['wizard', 'rogue', 'barbarian'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc, character }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r20\r'), ...(protect ? protectedHero() : []),
            ...(typeof actions === 'function' ? actions(character) : actions), keys('\x1b:\x1b'),
        ] }],
    };
}

function effectsFor(name: string): readonly [string, RegExp][] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-13 recipe ${name}`);
    return effects;
}

// apply.c:use_whistle() summons vault.c:invault(); gd_move() owns the escort.
function vaultVisits(name: string, follow: boolean): SessionAction[] {
    const actions: SessionAction[] = [...wish('cursed tin whistle'), identify()];
    for (const depth of [12, 16, 20]) {
        actions.push(keys('\x16'), answer('To what level', `${depth}\r`),
            ...wish('blessed scroll of gold detection', '1000 gold pieces'), identify(),
            choose('scroll of gold detection', 'r*'), keys('\x1b'));
        for (let visit = 0; visit < 24; visit++) {
            if (visit % 4 === 0) actions.push(...wish('uncursed K-ration'), choose('K-ration', 'me*'));
            actions.push(keys('\x14'), answer('Where do you want to be teleported?', 'o'.repeat(visit % 12 + 1) + '.'),
                choose('tin whistle', 'a*'), answer('Call ', '\r'),
                answer('"Hello stranger, who are you?"', `${name}\r`));
            if (name === 'Croesus') continue;
            if (follow) actions.push(answer('"Please drop that gold and follow me."', 'd$'));
            for (let turn = 0; turn < 24; turn++) actions.push(
                keys(follow ? '_' : 's'),
                ...(follow ? [answer('Where do you want to travel', `m${'hykulnjb'.charAt(turn % 8)}.\x1b`)] : []),
                answer('Call ', '\r'), answer('"Hello stranger, who are you?"', `${name}\r`));
        }
    }
    return actions;
}

// dbridge.c:both horizontal orientations share the castle's central row.
function castle(): SessionAction[] {
    return [...wish('uncursed wand of opening (0:8)', 'uncursed wand of locking (0:8)',
        'uncursed wand of striking (0:8)', '2 blessed scrolls of genocide'), identify(),
        keys('#wizintrinsic\r1000'), choose('deafness', ''), keys('\r'),
        keys('#wizintrinsic\r 1000'), choose('pass thru walls', ''), keys('\r'),
        keys('#wizintrinsic\r 1000'), choose('water walking', ''), keys('\r'), choose('castle', 'm\x16'),
        choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
        // The maze's solid outer border stops phasing movement at (2,2).
        keys('mh'.repeat(80) + 'mk'.repeat(21) + 'ml'.repeat(10) + 'mj'.repeat(9))];
}

// teleport.c:rloc_to_core() calls shk.c:make_angry_shk() for a displaced resident.
function displaceShopkeepers(): SessionAction[] {
    const actions = [keys('#wizintrinsic\r1000'), choose('monster detection', ''), keys('\r'),
        keys('#wizintrinsic\r 1000'), choose('pass thru walls', ''), keys('\r'), choose('minetn', 'm\x16'),
        ...monsterTeleportAnswers(), keys('#wizmap\r')];
    for (let visit = 0; visit < 8; visit++) {
        if (visit % 4 === 0) actions.push(...wish('uncursed K-ration'), choose('K-ration', 'me*'), ...monsterTeleportAnswers());
        const wand = `teleportation named beam ${visit}`;
        actions.push(...wish(`uncursed wand of teleportation (0:8) named beam ${visit}`), identify(),
            keys('\x14'), answer('Where do you want to be teleported?', 'm'.repeat(2 * visit + 1) + 'h.'),
            ...monsterTeleportAnswers(),
            ...[...'hykulnjb'].flatMap((direction, index) => zap(wand, direction,
                '<' + 'h'.repeat(2 + 2 * index) + 'j'.repeat(2 + visit % 10) + '.')));
    }
    return actions;
}

function protectedHero(): SessionAction[] {
    return [
        keys('T'), keys('m.'.repeat(5)),
        ...wish('blessed +50 gray dragon scale mail', 'uncursed ring of slow digestion'), identify(),
        choose('gray dragon scale mail', 'W*'), keys('m.'.repeat(5)),
        choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l'),
    ];
}

function zap(wand: string, direction: string, destination = '<.'): SessionAction[] {
    return [choose(`wand of ${wand}`, 'z*'), answer('In what direction?', direction), ...monsterTeleportAnswers(destination)];
}

function monsterTeleportAnswers(destination = '<.'): SessionAction[] {
    return Array.from({ length: 4 }, () => [answer('Call ', '\r'),
        answer('Teleport the ', '\x1b'), answer('Teleport ', destination), answer('<', 'y'),
        answer('(For instructions type', '\x1b')]).flat();
}

function wish(...items: string[]): SessionAction[] {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
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
