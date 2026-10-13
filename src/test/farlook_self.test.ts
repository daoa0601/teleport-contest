import assert from 'node:assert/strict';
import test from 'node:test';

import type { InitializedHero } from '../js/hero_types.js';
import { farlookLocationDescription, rhack } from '../js/cmd.js';
import { TER_MAP } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { races } from '../js/roles.js';
import { freshObjectRoom } from './support/object-room.js';

for (const role of ['wizard', 'knight'] as const) {
    void test(`farlook identifies the ${role} on the hero's square`, async () => {
        freshObjectRoom({ role });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);

        assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy),
            `human ${role} called Aster`);
    });
}

const selfSightCases: readonly {
    name: string;
    hero: Partial<InitializedHero>;
    description: string;
}[] = [
    {
        name: 'invisible hero sensed by telepathy',
        hero: { invisibleTurns: 10, unblind_telepat_range: 64 },
        description: 'invisible human wizard called Aster [seen: telepathy]',
    },
    {
        name: 'invisible hero sensed by monster detection',
        hero: { invisibleTurns: 10, detectMonsters: true },
        description: 'invisible human wizard called Aster [seen: monster detection]',
    },
    {
        name: 'invisible hero sensed by all three senses',
        hero: { invisibleTurns: 10, infravision: true,
            unblind_telepat_range: 64, detectMonsters: true },
        description: 'invisible human wizard called Aster [seen: infravision, telepathy, monster detection]',
    },
    {
        name: 'visible hero with telepathy',
        hero: { unblind_telepat_range: 64 },
        description: 'human wizard called Aster',
    },
    {
        name: 'invisible hero who can see invisible',
        hero: { invisibleTurns: 10, seeInvisible: true, unblind_telepat_range: 64 },
        description: 'invisible human wizard called Aster',
    },
    {
        name: 'blind invisible hero without a sensing ability',
        hero: { invisibleTurns: 10, blindTurns: 10 },
        description: 'human wizard called Aster',
    },
    {
        name: 'blind invisible hero with telepathy',
        hero: { invisibleTurns: 10, blindTurns: 10, unblind_telepat_range: 64 },
        description: 'invisible human wizard called Aster',
    },
    {
        name: 'swallowed invisible hero with telepathy',
        hero: { invisibleTurns: 10, uswallow: true, unblind_telepat_range: 64 },
        description: 'invisible human wizard called Aster',
    },
];

for (const { name, hero, description } of selfSightCases) {
    void test(`self-farlook describes the ${name}`, async () => {
        freshObjectRoom({ role: 'wizard', hero });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);

        assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy), description);
    });
}

void test('self-farlook explains monster detection when the hero is hidden', async () => {
    freshObjectRoom({ role: 'wizard', hero: { uundetected: true, detectMonsters: true } });

    const description = await farlookLocationDescription(game.u.ux, game.u.uy);

    assert.ok(description.endsWith(' [seen: monster detection]'), description);
});

void test('farlook respects terrain-only mode on the hero square', async () => {
    freshObjectRoom({ role: 'wizard' });
    game.iflags.terrainmode = TER_MAP;
    newsym(game.u.ux, game.u.uy);

    assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy), 'floor of a room');
});

for (const showrace of [true, false]) {
    void test(`self-farlook describes the displayed gnome glyph with showrace=${showrace}`, async () => {
        const race = races.find(candidate => candidate.name === 'gnome');
        assert.ok(race);
        freshObjectRoom({ role: 'wizard', race, flags: { tips: false, showrace } });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        const input = resetInputState();
        input.feed(';.');

        await rhack(0);
        await flush_screen(1);

        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
        assert.ok(description);
        assert.match(description, showrace
            ? /^G.*a gnome \(gnomish wizard called Aster\)$/
            : /^@.*a human or elf or you \(gnomish wizard called Aster\)$/);
    });

    void test(`self-farlook describes a polymorphed gnome with showrace=${showrace}`, async () => {
        const race = races.find(candidate => candidate.name === 'gnome');
        assert.ok(race);
        freshObjectRoom({ role: 'wizard', race, flags: { tips: false, showrace },
            hero: { umonnum: nameToMonster('newt'), mh: 8, mhmax: 8 } });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        const input = resetInputState();
        input.feed(';.');

        await rhack(0);
        await flush_screen(1);

        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
        assert.ok(description);
        assert.match(description, /^:.*a lizard \(newt called Aster\)$/);
    });
}

for (const form of ['ghost', 'shade']) {
    void test(`self-farlook includes the blank symbol's ambiguity while polymorphed into a ${form}`, async () => {
        freshObjectRoom({ role: 'wizard', flags: { tips: false },
            hero: { umonnum: nameToMonster(form), mh: 8, mhmax: 8 } });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        const input = resetInputState();
        input.feed(';.');

        await rhack(0);
        await flush_screen(1);

        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
        assert.ok(description?.endsWith(`can be many things (${form} called Aster)`), description);
    });
}
