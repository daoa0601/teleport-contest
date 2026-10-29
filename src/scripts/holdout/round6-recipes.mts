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

export const ROUND6_RECIPES: Record<string, Recipe> = {
    // apply.c:flip_coin(). Gold always uses the '$' inventory selector.
    'coin-flipping': recipe('Flip a carried gold piece.', ['The coin lands or slips from the hero\'s fingers.'], seed => [
        ...wish(`${pick(seed, [20, 30, 40])} gold pieces`), keys('a$'),
    ]),
    // apply.c:use_cream_pie(), use_towel().
    'pie-cleanup': recipe('Apply a cream pie, then wipe the goop away with a towel.',
        ['The pie blinds the hero.', 'The towel removes the goop.'], seed => [
            ...wish(`${pick(seed, [1, 2])} uncursed cream pies`, 'uncursed towel'),
            choose('cream pie', 'a*'), choose('towel', 'a*'),
        ]),
    // apply.c:use_candle(), use_candelabrum().
    'candelabrum-lighting': recipe('Attach seven candles to the Candelabrum, light them, then snuff them.',
        ['Seven candles are attached.', 'The Candelabrum burns brightly.', 'The candles are snuffed.'], seed => {
            const candles = `${pick(seed, ['wax', 'tallow'])} candles`;
            return [...wish('uncursed Candelabrum of Invocation', `7 uncursed ${candles}`),
                choose(candles, 'a*'), keys('y'), choose('Candelabrum', 'a*'), choose('Candelabrum', 'a*')];
        }),
    // apply.c:light_cocktail(), potion.c:peffect_oil().
    'burning-oil': recipe('Light a potion of oil and drink it while it is burning.',
        ['The oil is lit.', 'The burning oil burns the hero\'s face.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'uncursed'])} potion of oil`),
            choose('potion of oil', 'a*'), choose('potion of oil', 'mq*'),
        ]),
    // apply.c:use_grapple(), grapple_range().
    'grappling-practice': recipe('Cast a grappling hook at the hero\'s square.',
        ['The cast resolves against the hero or the floor.'], () => [
            ...wish('uncursed grappling hook'), choose('grappling hook', 'a*'), keys('.'),
        ]),
    // apply.c:use_leash(), use_leash_core(). A sleeping pet stays near
    // its creation square while adjacent directions are tried.
    'pet-leashing': recipe('Create a sleeping tame pet and attach a leash to it.',
        ['A pet is leashed.'], seed => {
            const actions = [...wish('uncursed leash'),
                keys(`\x07tame sleeping ${pick(seed, ['little dog', 'kitten'])}\r`)];
            for (const direction of pick(seed, ['hykulnjb', 'lnjbhyku']))
                actions.push(choose('leash', 'a*'), keys(direction));
            return actions;
        }),
    // apply.c:use_magic_whistle(), magic_whistled().
    'pet-recalling': recipe('Recall a tame creature with a magic whistle.',
        ['The whistle sounds.', 'A pet changes location.'], () => [
            ...wish('uncursed magic whistle'), keys('\x07tame floating eye\r'),
            choose('magic whistle', 'a*'), choose('magic whistle', 'a*'),
        ]),
    // apply.c:use_stethoscope(), its_dead().
    'corpse-diagnosis': recipe('Examine a corpse on the floor with a stethoscope.',
        ['The stethoscope diagnoses the corpse.'], seed => {
            const corpse = `${pick(seed, ['lichen', 'lizard'])} corpse`;
            return [...wish('uncursed stethoscope', `uncursed ${corpse}`),
                choose(corpse, 'd*'), choose('stethoscope', 'a*'), keys('>')];
        }),
    // apply.c:use_mirror(), beautiful().
    'mirror-reflection': recipe('Inspect the hero\'s reflection with a mirror.',
        ['The mirror describes the hero\'s appearance.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'uncursed'])} mirror`), choose('mirror', 'a*'), keys('.'),
        ]),
    // artifact.c:invoke_fling_poison().
    'artifact-venom': recipe('Invoke Grimtooth to fling venom downward.',
        ['Venom spatters on the floor.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'uncursed'])} Grimtooth`), choose('Grimtooth', '#invoke\r*'), keys('>'),
        ], ['rogue']),
    // artifact.c:invoke_blinding_ray(), zap.c:flashburn().
    'artifact-radiance': recipe('Invoke Sunsword at the hero to produce a blinding flash.',
        ['Sunsword blinds the hero.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'uncursed'])} Sunsword`), choose('Sunsword', '#invoke\r*'), keys('.'),
        ]),
    // artifact.c:invoke_energy_boost().
    'artifact-energy': recipe('Drain magical energy with a cursed potion, then invoke the Mitre of Holiness.',
        ['Magical energy is drained.', 'The Mitre restores energy.'], () => [
            ...wish('uncursed the Mitre of Holiness', 'cursed potion of gain energy'),
            choose('potion of gain energy', 'mq*'), choose('Mitre of Holiness', '#invoke\r*'),
        ], ['priest']),
    // potion.c:mixtype(), dip_potion_explosion(). Cursed dippees always
    // explode; uncursed ones can produce a diluted healing mixture.
    'potion-alchemy': recipe('Mix healing and speed potions, varying the dippee\'s beatitude.',
        ['The potions mix.', 'The mixture changes appearance or explodes.'], seed => [
            ...wish(`${pick(seed, ['uncursed', 'cursed'])} potion of healing`, 'uncursed potion of speed'),
            choose('potion of healing', 'm#dip\r*'), choose('potion of speed', '*'), keys('\x1bi\x1b'),
        ]),
    // read.c:do_class_genocide().
    'class-genocide': recipe('Read a blessed scroll to genocide a seeded monster class.',
        ['The chosen class is wiped out.'], seed => [
            ...wish('blessed scroll of genocide'), choose('scroll of genocide', 'r*'),
            keys(`${pick(seed, ['L', 'N'])}\r`),
        ]),
    // read.c:punish(), unpunish(). The chain disappears; the ball stays.
    'punishment-removal': recipe('Read punishment followed by remove curse, leaving an unattached iron ball.',
        ['Punishment attaches a ball and chain.', 'Remove curse removes the chain.'], () => [
            ...wish('uncursed scroll of punishment', 'uncursed scroll of remove curse'),
            choose('scroll of punishment', 'r*'), choose('scroll of remove curse', 'r*'), keys(':'),
        ]),
};

function castResolved(screens: readonly string[]): boolean {
    let aiming = false;
    for (const screen of screens) {
        if (/Never mind\.|What do you want to /.test(screen)) aiming = false;
        if (/Where do you want to hit\?/.test(screen)) aiming = true;
        if (aiming && /You hook yourself!|You are yanked toward the (?:floor|ground)!|Nothing happens\./.test(screen))
            return true;
    }
    return false;
}

export function validateRound6Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks: RecipeCheck[] = [];
    const has = (check: string, effect: RegExp) => checks.push({ check, ok: effect.test(text), evidence: '' });
    checks.push({ check: 'one recorded version-5 segment',
        ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' });
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    checks.push({ check: 'gameplay consumed turns', ok: (turns.at(-1) ?? 0) > (turns[0] ?? Infinity), evidence: '' });
    switch (name) {
    case 'coin-flipping':
        has('coin flipped', /You flip a gold piece\./);
        has('coin landed', /It comes up (?:heads|tails)\.|It slips between your fingers\./);
        break;
    case 'pie-cleanup':
        has('pie blinded the hero', /You can't see through all the sticky goop on your face\./);
        has('towel removed the goop', /You've got the glop off\./);
        break;
    case 'candelabrum-lighting':
        has('candles attached', /You attach 7 candles to the [Cc]andelabrum/);
        has('candles lit', /[Cc]andelabrum[^\n]*candles burn brightly!/);
        has('candles snuffed', /You snuff the candles\./);
        break;
    case 'burning-oil':
        has('oil lit', /You light your potion\./);
        has('burning oil drunk', /You burn your face\./);
        break;
    case 'grappling-practice':
        checks.push({ check: 'hook cast resolved', ok: castResolved(screens), evidence: '' });
        break;
    case 'pet-leashing':
        has('leash attached', /You slip the leash around your [^.\n]+\./);
        break;
    case 'pet-recalling':
        has('magic whistle sounded', /You produce a strange whistling sound\./);
        has('pet relocated', /(?:shifts? locations?|appears|vanishes and reappears)\./);
        break;
    case 'corpse-diagnosis':
        has('corpse diagnosed', /You determine that this unfortunate being is dead\./);
        break;
    case 'mirror-reflection':
        has('reflection described', /You look as \w+ as ever\./);
        break;
    case 'artifact-venom':
        has('venom hit the floor', /(?:A splash of venom|The venom) hits the [^.\n]+\./);
        break;
    case 'artifact-radiance':
        has('flash blinded the hero', /You are blinded by the flash!/);
        break;
    case 'artifact-energy':
        has('energy drained', /You feel lackluster\./);
        has('energy restored', /You feel re-energized\./);
        break;
    case 'potion-alchemy':
        has('potions mixed', /potions? of healing mix(?:es)? with the potion of speed\.\.\./);
        has('mixture reacted', /The mixture looks [^.\n]+\.|They explode!/);
        break;
    case 'class-genocide':
        has('class wiped out', /Wiped out all (?:liches|nagas|red nagas|black nagas|golden nagas|guardian nagas)\./);
        break;
    case 'punishment-removal':
        has('punishment imposed', /You are being punished for your misbehavior!/);
        has('remove curse took effect', /You feel like someone is helping you\./);
        checks.push({ check: 'unattached ball remains', ok: screens.some(screen =>
            /(?:You see here|Things that are here:)[\s\S]*heavy iron ball/.test(screen)
            && !/iron chain/.test(screen)), evidence: '' });
        break;
    default:
        throw new Error(`unknown round-6 recipe ${name}`);
    }
    return checks;
}
