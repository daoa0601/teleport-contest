import { itemAt } from '../lib/session-types.mjs';
import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

function keys(value: string): SessionAction {
    return { type: 'keys', value, dismissMore: true };
}

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function wish(...items: string[]): SessionAction[] {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}

function pick<T>(seed: number, choices: readonly T[]): T {
    return itemAt(choices, ((Math.imul(seed, 1664525) + 1013904223) >>> 0) % choices.length);
}

function recipe(description: string, success: string[], actions: (seed: number) => SessionAction[], roles = ['knight']): Recipe {
    return {
        roles, options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
        ] }],
    };
}

export const ROUND4_RECIPES: Record<string, Recipe> = {
    // shk.c:dopay(), pay_billed_items(), dopayobj().
    'shop-purchases': {
        ...recipe(
            'Detect Minetown merchandise, visit remembered objects, and buy goods from their shopkeeper.',
            ['Merchandise is purchased.', 'The shopkeeper acknowledges the payment.'], seed => {
                const actions: SessionAction[] = [
                    ...wish('10000 gold pieces', 'blessed potion of object detection'),
                    choose('minetn', 'm\x16'), choose('potion of object detection', 'mq*'), keys('\x1b'),
                ];
                // getpos cycles remembered objects by distance. Picking up
                // single items removes them from the next destination list.
                for (let visit = 0; visit < 24; visit++) {
                    const next = visit === 0 ? pick(seed, ['o', 'oo', 'ooo']) : 'o';
                    actions.push(keys(`\x14${next}.,\x1bpyy\x1b`));
                }
                return actions;
            }),
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'menustyle:traditional'],
    },
    // music.c:do_improvisation(), do_earthquake().
    'magic-instruments': recipe(
        'Play a seeded charged magical instrument, producing sleep, charm, or an earthquake.',
        ['Improvisation starts.', 'The instrument produces its magical effect.'], seed => {
            const instrument = pick(seed, ['magic flute', 'magic harp', 'drum of earthquake']);
            return [...wish(`uncursed ${instrument} (0:3)`), choose(instrument, 'a*'),
                ...(instrument === 'drum of earthquake' ? [] : [keys('y')])];
        }),
    // apply.c:use_figurine(), dog.c:make_familiar().
    'figurine-activation': recipe(
        'Activate a seeded blessed animal figurine on the ground to create a familiar.',
        ['The figurine transforms into a monster.'], seed => [
            ...wish(`blessed figurine of a ${pick(seed, ['kitten', 'little dog', 'pony', 'monkey'])}`),
            choose('figurine', 'a*'), keys('.'),
        ]),
    // artifact.c:invoke_healing().
    'artifact-healing': recipe(
        'Cure potion-induced blindness by invoking the Staff of Aesculapius, varying its beatitude.',
        ['The artifact is invoked.', 'Its healing power takes effect.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'uncursed'])} the Staff of Aesculapius`, 'uncursed potion of blindness'),
            choose('potion of blindness', 'mq*'), choose('Staff of Aesculapius', '#invoke\r*'),
        ], ['healer']),
    // artifact.c:invoke_untrap(), trap.c:untrap_box(), disarm_box().
    'artifact-untrapping': recipe(
        'Invoke the Master Key of Thievery to discover and disarm a seeded trapped container.',
        ['The artifact is invoked.', 'The container trap is disarmed.'], seed => {
            const box = pick(seed, ['chest', 'large box']);
            return [...wish('uncursed the Master Key of Thievery', `uncursed empty trapped ${box}`),
                choose(box, 'd*'), choose('Master Key of Thievery', '#invoke\r*'), keys('.yy')];
        }, ['rogue']),
    // pray.c:doturn(), maybe_turn_mon_iter().
    'undead-turning': recipe(
        'Create a seeded hostile undead creature and chant the Knight\'s turning formula.',
        ['The turning formula is chanted.', 'An undead monster is destroyed.', 'The hero recovers from the turning delay.'], seed => [
            keys(`\x07hostile ${pick(seed, ['kobold zombie', 'gnome zombie', 'orc mummy'])}\r#turn\r`),
        ]),
    // polyself.c:dogaze().
    'monster-gaze': recipe(
        'Become a seeded gaze attacker, gaze at a nearby hostile newt, and return to human form.',
        ['The hero takes a gaze-attacking form.', 'A monster is affected by the gaze.', 'Human form is restored.'], seed => [
            keys(`#polyself\r${pick(seed, ['umber hulk', 'pyrolisk'])}\r\x07hostile newt\r#monster\r#polyself\rknight\r`),
        ]),
    // sit.c:dosit(), pray.c:altar_wrath(), water_prayer(), pleased().
    'altar-water': recipe(
        'Sit on a lawful altar, then pray over a seeded stack of ordinary water to bless it.',
        ['The hero sits on an altar.', 'Prayer finishes.', 'Water on the altar is blessed.'], seed => [
            ...wish('lawful altar'), keys('#sit\r'),
            ...wish(`${pick(seed, [2, 3, 4])} uncursed potions of water`),
            choose('water', 'd*'), keys('#pray\ryy'),
        ]),
};

function followsPrompt(screens: readonly string[], prompt: RegExp, effect: RegExp): boolean {
    let pending = false;
    for (const screen of screens) {
        if (/Never mind\./.test(screen)) pending = false;
        else if (prompt.test(screen)) pending = true;
        else if (/What do you want to /.test(screen)) pending = false;
        if (pending && effect.test(screen)) return true;
    }
    return false;
}

export function validateRound4Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks: RecipeCheck[] = [];
    const require = (check: string, ok: boolean) => { checks.push({ check, ok, evidence: '' }); };
    const has = (check: string, effect: RegExp) => require(check, effect.test(text));
    require('one recorded version-5 segment', session.version === 5 && session.segments.length === 1 && screens.length >= 2);
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    require('gameplay consumed turns', (turns.at(-1) ?? 0) > (turns[0] ?? Infinity));
    switch (name) {
    case 'shop-purchases':
        has('merchandise purchased', /[Yy]ou bought .* for \d+ gold pieces?\./);
        has('shopkeeper acknowledges payment', /Thank you for shopping in /);
        break;
    case 'magic-instruments':
        has('improvisation started', /You start playing /);
        has('magical music took effect', /You produce soft(?:, familiar)? music\.|harp produces very attractive(?: and familiar)? music\.|The entire \w+ is shaking around you!/);
        break;
    case 'figurine-activation':
        has('figurine transformed', /You (?:set the figurine (?:on the ground|beside you)|toss the figurine into the air|release the figurine) and it transforms\./);
        require('familiar creation succeeded', !/figurine writhes and then shatters|\.\.\. into a pile of dust\./.test(text));
        break;
    case 'artifact-healing':
        require('invoked healing took effect', followsPrompt(screens, /What do you want to invoke\?/, /You feel better\./));
        break;
    case 'artifact-untrapping':
        require('invoked untrapping completed', followsPrompt(screens, /What do you want to invoke\?/, /You disarm it!/));
        break;
    case 'undead-turning':
        has('turning formula chanted', /Calling upon .*, you chant an arcane formula\./);
        has('undead monster destroyed', /You destroy (?:the |an? )?(?:kobold zombie|gnome zombie|orc mummy)!/);
        has('turning delay ended', /You can move again\./);
        break;
    case 'monster-gaze':
        has('gaze form taken', /You turn into an? (?:umber hulk|pyrolisk)!/);
        has('gaze affects a monster', /Your gaze confuses |You attack .* with a fiery gaze!/);
        has('human form restored', /You return to human form!/);
        break;
    case 'altar-water':
        has('sat on an altar', /You sit on the altar\./);
        has('prayer completed', /You finish your prayer\./);
        has('water blessed', /potions? on the altar glow(?:s)? light blue for a moment\./);
        break;
    default:
        throw new Error(`unknown round-4 recipe ${name}`);
    }
    return checks;
}
