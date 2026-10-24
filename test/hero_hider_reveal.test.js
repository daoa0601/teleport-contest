import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { COLNO, MM_ANGRY, MM_NOGRP, NO_MINVENT, ROOM, ROWNO, SQKY_BOARD, STONE } from '../js/const.js';
import { maketrap } from '../js/mklev.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { useHeroHide } from '../js/hero_hide.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { resetInputState } from '../js/input.js';
import { flush_screen } from '../js/display.js';
import { TOWEL } from '../js/object_data.js';
import { requireScreenCell } from './support/screen.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const REVEAL_PROSE = /fall|board|piercer|ogre|snake|hiding|Wait|mimic|hit|miss|It |turn into/i;
function finalProse(messages) {
    return `${messages.join('\n')}\n${game._pending_message ?? ''}`;
}
function revealRoom() {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Mope';
    const input = resetInputState();
    installPagerInput(input, { expected: REVEAL_PROSE, limit: 12 });
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
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
async function runAttack(ogre) {
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
    assert.equal((await useHeroHide({ publish: async () => { } })).spentTime, true);
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
    assert.notEqual(`${game.u.ux},${game.u.uy}`, `${heroX},${heroY}`, 'the hero lands on a different square');
});
void test('a falling piercer lands on the attacker\'s vacated square', async () => {
    const { messages } = revealRoom();
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('rock piercer'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => { } })).spentTime, true);
    const level = requireGameLevel(game);
    const heroX = game.u.ux;
    const heroY = game.u.uy;
    const ogre = await attackingOgre();
    // Only the attacker's own square is standable: C takes the attacker off
    // the map before the search, so that square must win for the hero.
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).typ = STONE;
    level.requireAt(heroX, heroY).typ = ROOM;
    level.requireAt(ogre.mx, ogre.my).typ = ROOM;
    await runAttack(ogre);
    const prose = finalProse(messages);
    assert.doesNotMatch(prose, /draws back/, `the swap must happen: ${prose}`);
    assert.match(prose, /It is hit by a falling piercer \(you\)!/);
    assert.equal(ogre.mx, heroX, 'the attacker takes the hero\'s old square');
    assert.equal(ogre.my, heroY, 'the attacker takes the hero\'s old square');
    assert.equal(game.u.ux, 11, 'the hero lands on the attacker\'s old square');
    assert.equal(game.u.uy, 10, 'the hero lands on the attacker\'s old square');
});
void test('a falling piercer springs a trap on its landing square', async () => {
    const { messages } = revealRoom();
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('rock piercer'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => { } })).spentTime, true);
    const level = requireGameLevel(game);
    const heroX = game.u.ux;
    const heroY = game.u.uy;
    const ogre = await attackingOgre();
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).typ = STONE;
    level.requireAt(heroX, heroY).typ = ROOM;
    level.requireAt(ogre.mx, ogre.my).typ = ROOM;
    await maketrap(ogre.mx, ogre.my, SQKY_BOARD);
    await runAttack(ogre);
    const prose = finalProse(messages);
    assert.equal(game.u.ux, 11, 'the hero lands on the attacker\'s old square');
    assert.match(prose, /A board beneath you squeaks/);
    assert.match(prose, /falling piercer \(you\)!/, 'the piercer still strikes after landing');
});
void test('a hiding snake hero is pointed out to its attacker', async () => {
    const { messages } = revealRoom();
    await floorObject(TOWEL, game.u.ux, game.u.uy, { dknown: true });
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('snake'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => { } })).spentTime, true);
    assert.equal(game.u.uundetected, 1);
    const ogre = await attackingOgre();
    await runAttack(ogre);
    const prose = finalProse(messages);
    assert.ok(prose.includes('Wait, ogre!  There\'s a snake named Mope hiding under an uncursed towel!'), `unexpected prose: ${prose}`);
    assert.equal(game.u.uundetected, 0);
    assert.equal(ogre.mhp, ogre.mhpmax, 'the attacker never strikes the revealed hero');
    await flush_screen(1);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, 'S', 'the revealed hero is drawn on its square again');
});
void test('a mimicking hero is unmasked instead of attacked', async () => {
    const { messages } = revealRoom();
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('small mimic'))).transformed, true);
    assert.equal((await useHeroHide({ publish: async () => { } })).spentTime, true);
    assert.ok((game.u.m_ap_type ?? 0) !== 0, 'the hero mimics an object');
    const ogre = await attackingOgre();
    await runAttack(ogre);
    const prose = finalProse(messages);
    assert.ok(prose.includes('Wait, ogre!  That\'s a small mimic named Mope!'), `unexpected prose: ${prose}`);
    assert.equal(game.u.m_ap_type ?? 0, 0, 'the disguise is dropped');
    assert.equal(ogre.mhp, ogre.mhpmax, 'the attacker never strikes the mimic');
});
//# sourceMappingURL=hero_hider_reveal.test.js.map