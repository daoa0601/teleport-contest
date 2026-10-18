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

export const ROUND5_RECIPES: Record<string, Recipe> = {
    // write.c:dowrite(), cost(), new_book_description().
    'spellbook-writing': recipe(
        'Write a seeded known spell into a blank spellbook with a charged magic marker.',
        ['A spellbook writing request is answered.', 'The blank book becomes a written spellbook.'], seed => {
            const spell = pick(seed, ['force bolt', 'healing', 'light', 'detect food']);
            return [...wish('blessed magic marker (0:80)', 'uncursed spellbook of blank paper', `blessed spellbook of ${spell}`),
                choose('magic marker', 'a*'), choose('blank', '*'), keys(`${spell}\ri\x1b`)];
        }),
    // spell.c:deadbook(), zap.c:unturn_dead(), mkroom.c:mkundead().
    'deadbook-raising': recipe(
        'Read a cursed Book of the Dead while carrying a seeded corpse, raising nearby undead.',
        ['The Book of the Dead is read.', 'Its curse raises the dead.'], seed => [
            ...wish('cursed Book of the Dead', `uncursed ${pick(seed, ['kobold', 'gnome', 'orc'])} corpse`),
            choose('Book of the Dead', 'r*'), keys('\x1bi\x1b'),
        ]),
    // apply.c:use_royal_jelly(), timeout.c:attach_egg_hatch_timeout().
    'royal-jelly-eggs': recipe(
        'Smear seeded blessed or cursed royal jelly on killer bee eggs, changing them into queen bee eggs.',
        ['Royal jelly is applied to eggs.', 'The eggs become queen bee eggs.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'cursed'])} lump of royal jelly`, '2 uncursed killer bee eggs'),
            choose('royal jelly', '#rub\r*'), choose('killer bee egg', '*'), keys('i\x1b'),
        ]),
    // apply.c:dorub(), potion.c:djinni_from_bottle(), mongrantswish().
    'magic-lamp-release': recipe(
        'Rub a seeded blessed or uncursed magic lamp until its djinni is released.',
        ['A djinni emerges from the lamp.', 'The djinni speaks and the lamp becomes an oil lamp.'], seed => {
            const actions = wish(`${pick(seed, ['blessed', 'uncursed'])} magic lamp`);
            // Escape accepts a random object if a djinni offers a wish;
            // at a command prompt it leaves the next rub ready to start.
            for (let attempt = 0; attempt < 12; attempt++)
                actions.push(choose('lamp', '#rub\r*'), keys('\x1b'));
            // The replacement oil lamp has its own discovery state.
            actions.push(keys('\t\t\ri\x1b'));
            return actions;
        }),
    // artifact.c:invoke_banish(), dog.c:migrate_mon().
    'demon-banishing': recipe(
        'Create a seeded ordinary demon and invoke Demonbane to send it to Gehennom.',
        ['Demonbane is invoked.', 'A demon disappears in brimstone.'], seed => [
            ...wish(`${pick(seed, ['blessed', 'uncursed'])} Demonbane`),
            keys(`\x07hostile ${pick(seed + 1, ['manes', 'lemure', 'imp'])}\r`),
            choose('Demonbane', '#invoke\r*'),
        ]),
    // artifact.c:invoke_storm_spell(), spell.c:throwspell().
    'artifact-storms': recipe(
        'Invoke a seeded elemental Brand at the hero to cast an expert storm of explosions.',
        ['An artifact storm is targeted.', 'Its elemental explosion catches the hero.'], seed => {
            const brand = pick(seed, ['Fire Brand', 'Frost Brand']);
            const element = brand === 'Fire Brand' ? 'fire' : 'cold';
            // Resistance lets every explosion finish even on low-HP Wizards.
            return [...wish(`uncursed ${brand}`, `uncursed ring of ${element} resistance`),
                choose(`ring of ${element} resistance`, 'P*'), keys('l'),
                choose('Brand', '#invoke\r*'), keys('.')];
        }, ['wizard']),
    // apply.c:jump(), get_valid_jump_position(), check_jump().
    'pit-jumping': recipe(
        'Trigger a seeded pit by jumping in place, leap out, then attempt a short directional jump.',
        ['Jumping triggers a pit.', 'A second jump escapes the pit.'], seed => [
            keys('\x14l.'), ...wish('fountain', 'floor', 'uncursed jumping boots'),
            choose('jumping boots', 'W*'), ...wish(pick(seed, ['pit', 'spiked pit'])),
            // '$' cycles valid-destination highlighting before landing.
            keys(`#jump\r$$$.#jump\r.#jump\r${pick(seed + 1, ['l', 'h', 'j', 'k'])}.\x1b`),
        ], ['barbarian']),
};

export function validateRound5Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
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
    case 'spellbook-writing':
        has('spellbook writing requested', /What type of spellbook do you want to write\?/);
        has('written spellbook created', /The spellbook warps strangely, then turns [^.\n]+\./);
        break;
    case 'deadbook-raising':
        has('Book of the Dead read', /You turn the pages of the Book of the Dead\.\.\./);
        has('dead raised', /You raised the dead!/);
        break;
    case 'royal-jelly-eggs':
        has('royal jelly applied to eggs', /You smear royal jelly all over your (?:[^.\n]*killer bee )?eggs?\./);
        has('eggs reacted to royal jelly', /The (?:queen bee )?eggs? quiver(?:s)? (?:briefly|feebly)\./);
        has('queen bee eggs produced', /^\s*[a-zA-Z] - [^\n]*queen bee eggs?\b/m);
        break;
    case 'magic-lamp-release':
        has('djinni released', /In a cloud of smoke, an? djinni emerges!/);
        has('djinni spoke', /The djinni speaks\./);
        has('lamp converted to oil lamp', /^\s*[a-zA-Z] - [^\n]*oil lamp\b/m);
        break;
    case 'demon-banishing':
        has('invocation requested', /What do you want to invoke\?/);
        has('demon banished', /The demons? disappear(?:s)? in a cloud of brimstone!/);
        break;
    case 'artifact-storms':
        has('storm targeted', /Where do you want to cast the spell\?/);
        has('elemental explosion hit the hero', /You are caught in the (?:fireball|ball of cold)!/);
        break;
    case 'pit-jumping':
        has('jump triggered the trap', /You jump up and come back down\./);
        has('jump escaped the pit', /You leap from the pit!/);
        break;
    default:
        throw new Error(`unknown round-5 recipe ${name}`);
    }
    return checks;
}
