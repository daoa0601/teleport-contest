import assert from 'node:assert/strict';
import test from 'node:test';

import { performMonsterHeroAttack } from '../js/allmain.js';
import { M_SEEN_FIRE, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove, takeMonsterTurn } from '../js/monmove.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { resistant, cancelled, approaches } of [
    { resistant: true, cancelled: false, approaches: true },
    { resistant: false, cancelled: false, approaches: false },
    { resistant: true, cancelled: true, approaches: false },
]) {
    const contact = cancelled ? 'cancelled fire contact'
        : resistant ? 'seeing fire fail' : 'seeing fire hurt the hero';
    void test(`a pyrolisk ${approaches ? 'approaches' : 'retreats'} after ${contact}`, async () => {
        freshObjectRoom({ right: 18, hero: { fireResistance: resistant, uhp: 200, uhpmax: 200 } });
        requirePlayingGame(game);
        const pyrolisk = await createMonsterAt('pyrolisk', 13, 10, MM_ANGRY | NO_MINVENT);
        pyrolisk.msleeping = 0;
        pyrolisk.seen_resistance = resistant ? 0 : M_SEEN_FIRE;
        const vortex = await createMonsterAt('fire vortex', 11, 10, MM_ANGRY | NO_MINVENT);
        vortex.mspec_used = 2; // A recently released hero can be touched, but not engulfed.
        vortex.mcan = cancelled ? 1 : 0;
        vortex.mux = game.u.ux;
        vortex.muy = game.u.uy;
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');

        await performMonsterHeroAttack(vortex, game, {
            random: limit => limit - 1, rollOne: () => 1, rollDice: () => 1,
        });
        await takeMonsterTurn(pyrolisk, game, limit => limit - 1);

        const distance = (pyrolisk.mx - game.u.ux) ** 2 + (pyrolisk.my - game.u.uy) ** 2;
        assert.ok(approaches ? distance < 9 : distance > 9,
            `The pyrolisk should ${approaches ? 'close in after fire proves ineffective' : 'back away to use fire'}; squared distance was ${distance}`);
    });
}

for (const form of ['paper golem', 'straw golem']) {
    for (const { resistant, unchanging } of [
        { resistant: false, unchanging: false },
        { resistant: true, unchanging: false },
        { resistant: true, unchanging: true },
    ]) {
        void test(`a pyrolisk retreats after fire burns a ${unchanging ? 'unchanging ' : ''}${resistant ? 'fire-resistant ' : ''}${form} hero out of its form`, async () => {
            freshObjectRoom({ right: 18, hero: { uhp: 200, uhpmax: 200 } });
            requirePlayingGame(game);
            installPolymorphedHero(form, { unchanging });
            if (resistant) grantIntrinsicProperty('fireResistance', 'outside');
            const pyrolisk = await createMonsterAt('pyrolisk', 13, 10, MM_ANGRY | NO_MINVENT);
            pyrolisk.msleeping = 0;
            pyrolisk.seen_resistance = M_SEEN_FIRE;
            const vortex = await createMonsterAt('fire vortex', 11, 10, MM_ANGRY | NO_MINVENT);
            vortex.mspec_used = 2;
            vortex.mux = game.u.ux;
            vortex.muy = game.u.uy;
            const input = resetInputState();
            input.beforeRead = () => input.feed(' ');

            await performMonsterHeroAttack(vortex, game, {
                random: limit => limit - 1, rollOne: () => 1, rollDice: () => 1,
            });
            await takeMonsterTurn(pyrolisk, game, limit => limit - 1);

            const distance = (pyrolisk.mx - game.u.ux) ** 2 + (pyrolisk.my - game.u.uy) ** 2;
            assert.ok(distance > 9,
                `The pyrolisk should back away to use fire after seeing the golem burn; squared distance was ${distance}`);
            assert.equal(heroIsPolymorphed(game), false, 'Fire destroys the golem body regardless of resistance');
            assert.equal(game.u.uhp, 199, 'The original contact damage reaches the restored human body');
        });
    }
}

for (const fireResistanceKnown of [true, false]) {
    void test(`a hell hound ${fireResistanceKnown ? 'approaches a hero known to resist fire' : 'backs away to use its fire breath'}`, async () => {
        freshObjectRoom({ left: 8, right: 18, top: 8, bottom: 12, heroX: 13, heroY: 10 });
        requirePlayingGame(game);
        const hound = await createMonsterAt('hell hound', 10, 10, MM_ANGRY | NO_MINVENT);
        hound.msleeping = 0;
        hound.seen_resistance = fireResistanceKnown ? M_SEEN_FIRE : 0;

        await takeMonsterTurn(hound, game, limit => limit - 1);

        assert.equal(hound.mx, fireResistanceKnown ? 11 : 9);
    });
}

void test('a confused Chromatic Dragon can wander toward the hero instead of retreating for breath', async () => {
    freshObjectRoom({ left: 8, right: 18, top: 8, bottom: 12, heroX: 13, heroY: 10 });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('Chromatic Dragon', 10, 10, MM_ANGRY | NO_MINVENT);
    dragon.mconf = 1;

    await beginMonsterMove(dragon, game, () => 0);

    assert.equal(dragon.mx, 11);
    assert.equal(dragon.mconf, 1);
});
