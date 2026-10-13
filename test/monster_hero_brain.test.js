import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { A_INT, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { HELMET } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a mind flayer tentacle damages the hero and drains intelligence through negative armor class', async () => {
    freshObjectRoom({ hero: {
            uac: -5, uhp: 100, uhpmax: 100,
            acurr: { a: [10, 20, 10, 10, 10, 10] }, amax: { a: [10, 20, 10, 10, 10, 10] },
        } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('master mind flayer', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    flayer.mux = game.u.ux;
    flayer.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message ?? ''); };
    input.feed(' '.repeat(32));
    await performMonsterHeroAttack(flayer, game, {
        random: limit => limit - 1,
        rollOne: sides => sides === 21 ? 1 : sides,
    });
    assert.equal(game.u.uhp, 98, 'negative armor class does not reduce damage from a penetrating tentacle');
    assert.equal(game.u.acurr?.a[A_INT], 18);
    const text = [...messages, game._last_message].join('\n');
    assert.match(text, /tentacles suck your brain/);
    assert.match(text, /Your brain is eaten!/);
});
for (const greased of [false, true]) {
    void test(`a ${greased ? 'greased' : 'plain'} helmet protects intelligence while a tentacle still deals contact damage`, async () => {
        freshObjectRoom({ hero: {
                uac: -5, uhp: 100, uhpmax: 100,
                acurr: { a: [10, 20, 10, 10, 10, 10] }, amax: { a: [10, 20, 10, 10, 10, 10] },
            } });
        requirePlayingGame(game);
        game.uarmh = await knownObject(HELMET, { greased });
        const flayer = await createMonsterAt('master mind flayer', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        flayer.mux = game.u.ux;
        flayer.muy = game.u.uy;
        resetInputState().feed(' '.repeat(32));
        await performMonsterHeroAttack(flayer, game, {
            random: limit => limit - 1,
            rollOne: sides => sides === 21 ? 1 : sides,
        });
        assert.equal(game.u.uhp, 99);
        assert.equal(game.u.acurr?.a[A_INT], 20);
        assert.equal(game.uarmh.greased, greased);
    });
}
void test('a headless hero takes the first tentacle hit and skips the remaining brain attacks', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('gray ooze', { hitPoints: 50 });
    game.u.uac = 0;
    const intelligence = game.u.acurr?.a[A_INT];
    const flayer = await createMonsterAt('master mind flayer', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    flayer.m_lev = 1;
    flayer.mux = game.u.ux;
    flayer.muy = game.u.uy;
    resetInputState().feed(' '.repeat(32));
    await performMonsterHeroAttack(flayer, game, {
        random: limit => limit - 1,
        rollOne: sides => sides === 20 ? 20 : 1,
    });
    assert.equal(game.u.mh, 48);
    assert.equal(game.u.acurr?.a[A_INT], intelligence);
});
void test('memory loss ends the remaining tentacle attacks in the same move', async () => {
    freshObjectRoom({ hero: {
            uac: 0, uhp: 100, uhpmax: 100,
            acurr: { a: [10, 20, 10, 10, 10, 10] }, amax: { a: [10, 20, 10, 10, 10, 10] },
        } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('master mind flayer', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    flayer.m_lev = 1;
    flayer.mux = game.u.ux;
    flayer.muy = game.u.uy;
    resetInputState().feed(' '.repeat(32));
    await performMonsterHeroAttack(flayer, game, {
        random: limit => limit === 5 ? 0 : limit - 1,
        rollOne: sides => sides === 20 ? 20 : 1,
    });
    assert.equal(game.u.uhp, 98);
    assert.equal(game.u.acurr?.a[A_INT], 19);
});
//# sourceMappingURL=monster_hero_brain.test.js.map