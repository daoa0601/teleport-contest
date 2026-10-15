import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function attackWithDeath(outcome: number) {
    requirePlayingGame(game);
    const rider = await createMonsterAt('Death', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    rider.mux = game.u.ux;
    rider.muy = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /Death|death|drain|Lucky|human|jackal|feel|stagger/, limit: 20 });
    await performMonsterHeroAttack(rider, game, {
        random: range => range === 20 ? outcome : range === 33 ? 0 : range - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    return [...messages, game._pending_message].join('\n');
}

void test('a lucky hero escapes both of Death\'s touches without damage', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: 10 } });

    const prose = await attackWithDeath(0);

    assert.equal(game.u.uhp, 500);
    assert.equal(game.u.uhpmax, 500);
    assert.equal(prose.match(/Lucky for you, it didn't work!/g)?.length, 2);
    assert.match(prose, /Death reaches out with its deadly touch\./);
});

void test('Death drains maximum HP in proportion to current HP and hero level', async () => {
    freshObjectRoom({ hero: { uhp: 300, uhpmax: 300, ulevel: 20, uac: 10 } });

    const prose = await attackWithDeath(5);

    assert.equal(game.u.uhp, 172);
    assert.equal(game.u.uhpmax, 236);
    assert.match(prose, /You feel your life force draining away/);
});

void test('Death only deals reduced contact damage to an undead hero', async () => {
    freshRoomWithPolymorphedHero('human zombie', {
        polymorph: { hitPoints: 500 }, hero: { uac: 10 },
    });

    const prose = await attackWithDeath(19);

    assert.equal(game.u.mh, 436);
    assert.equal(game.u.mhmax, 500);
    assert.equal(prose.match(/Was that the touch of death\?/g)?.length, 2);
});

void test('antimagic changes Death\'s fatal touch into ordinary life force drain', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: 10, antimagic: true } });

    const prose = await attackWithDeath(19);

    assert.equal(game.u.uhp, 372);
    assert.equal(game.u.uhpmax, 372);
    assert.doesNotMatch(prose, /You feel drained\.\.\./);
});

void test('a full touch of death applies its own HP drain without armor or half physical protection', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -10, halfPhysicalDamage: true } });

    const prose = await attackWithDeath(19);

    assert.equal(game.u.uhp, 304);
    assert.equal(game.u.uhpmax, 402);
    assert.equal(prose.match(/You feel drained\.\.\./g)?.length, 2);
});

void test('a full touch of death ends a living monster form before the next touch', async () => {
    freshRoomWithPolymorphedHero('jackal', {
        polymorph: { hitPoints: 100 }, hero: { uhp: 500, uhpmax: 500, uac: 10 },
    });

    await attackWithDeath(19);

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, 402);
    assert.equal(game.u.uhpmax, 451);
});
