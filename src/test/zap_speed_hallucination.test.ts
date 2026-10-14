import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { monsterName } from '../js/monster_name.js';
import { WAN_SPEED_MONSTER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { dozap } from '../js/zap.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const condition of ['already fast', 'frozen', 'immobile'] as const) {
    void test(`speed magic on a target that is ${condition} preserves the next hallucinated name`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const target = await createMonsterAt(condition === 'immobile' ? 'brown mold' : 'pony', 11, 10);
        const nextTarget = await createMonsterAt('pony', 10, 11);
        if (condition === 'already fast') target.permspeed = target.mspeed = MFAST;
        if (condition === 'frozen') target.mfrozen = 10;
        const wand = await addInventoryObject(WAN_SPEED_MONSTER, { spe: 3 });
        game.u.hallucinationTurns = 20;
        initRng(123n);
        const expectedName = monsterName(nextTarget, { capitalized: true });
        initRng(123n);
        pushKeys(`${wand.invlet}l`);

        await dozap();

        assert.equal(target.mspeed, MFAST);
        assert.equal(game._pending_message, '');
        pushKeys(`${wand.invlet}j`);
        await dozap();
        assert.equal(game._pending_message, `${expectedName} is suddenly moving faster.`);
        assert.equal(wand.spe, 1);
    });
}

void test('speed magic names a hallucinated sleeping target only when it wakes up', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('pony', 11, 10);
    target.msleeping = 1;
    const wand = await addInventoryObject(WAN_SPEED_MONSTER, { spe: 2 });
    game.u.hallucinationTurns = 20;
    initRng(123n);
    const expectedName = monsterName(target, { capitalized: true });
    initRng(123n);
    pushKeys(`${wand.invlet}l`);

    await dozap();

    assert.equal(game._pending_message, `${expectedName} wakes up.`);
    assert.equal(target.msleeping, 0);
    assert.equal(target.mspeed, MFAST);
    assert.equal(wand.spe, 1);
});
