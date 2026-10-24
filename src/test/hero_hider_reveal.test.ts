import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { useHeroHide } from '../js/hero_hide.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import type { Monster } from '../js/monster_types.js';
import { polymonHero } from '../js/polyself.js';
import { resetInputState } from '../js/input.js';
import { TOWEL } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const REVEAL_PROSE = /fall|piercer|ogre|snake|hiding|Wait|mimic|hit|miss|It |turn into/i;

function finalProse(messages: string[]): string {
    return `${messages.join('\n')}\n${game._pending_message ?? ''}`;
}

function revealRoom() {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Mope';
    const input = resetInputState();
    installPagerInput(input, { expected: REVEAL_PROSE, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => {
        if (game._pending_message) messages.push(game._pending_message);
    };
    return { messages };
}

async function attackingOgre() {
    const ogre = await createMonsterAt('ogre', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    ogre.msleeping = 0;
    ogre.mux = game.u.ux;
    ogre.muy = game.u.uy;
    return ogre;
}

async function runAttack(ogre: Monster) {
    requirePlayingGame(game);
    await performMonsterHeroAttack(ogre, game, {
        random: () => 0,
        rollOne: sides => (sides === 20 ? 20 : 1),
        rollDice: () => 2,
    });
}

void test('a hiding piercer hero drops onto its attacker and swaps squares', async () => {
    const { messages } = revealRoom();
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('rock piercer'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => {} })).spentTime, true);
    assert.equal(game.u.uundetected, 1);
    const heroX = game.u.ux;
    const heroY = game.u.uy;
    const ogre = await attackingOgre();
    const ogreHp = ogre.mhp;

    await runAttack(ogre);

    const prose = finalProse(messages);
    assert.match(prose, /You fall from the ceiling!/);
    assert.match(prose, /It is hit by a falling piercer \(you\)!/);
    assert.ok(ogre.mhp < ogreHp, 'the falling piercer hurts the attacker');
    assert.equal(game.u.uundetected, 0);
    assert.equal(ogre.mx, heroX, 'the attacker takes the hero\'s old square');
    assert.notEqual(`${game.u.ux},${game.u.uy}`, `${heroX},${heroY}`,
        'the hero lands on a different square');
});

void test('a hiding snake hero is pointed out to its attacker', async () => {
    const { messages } = revealRoom();
    await floorObject(TOWEL, game.u.ux, game.u.uy, { dknown: true });
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('snake'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => {} })).spentTime, true);
    assert.equal(game.u.uundetected, 1);
    const ogre = await attackingOgre();

    await runAttack(ogre);

    const prose = finalProse(messages);
    assert.ok(prose.includes('Wait, ogre!  There\'s a snake named Mope hiding under an uncursed towel!'),
        `unexpected prose: ${prose}`);
    assert.equal(game.u.uundetected, 0);
    assert.equal(ogre.mhp, ogre.mhpmax, 'the attacker never strikes the revealed hero');
});

void test('a mimicking hero is unmasked instead of attacked', async () => {
    const { messages } = revealRoom();
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('small mimic'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => {} })).spentTime, true);
    assert.ok((game.u.m_ap_type ?? 0) !== 0, 'the hero mimics an object');
    const ogre = await attackingOgre();

    await runAttack(ogre);

    const prose = finalProse(messages);
    assert.ok(prose.includes('Wait, ogre!  That\'s a small mimic named Mope!'),
        `unexpected prose: ${prose}`);
    assert.equal(game.u.m_ap_type ?? 0, 0, 'the disguise is dropped');
    assert.equal(ogre.mhp, ogre.mhpmax, 'the attacker never strikes the mimic');
});
