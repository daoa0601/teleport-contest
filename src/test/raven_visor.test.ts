import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { HELMET, OBJECT_DESCRIPTIONS } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { heroIsBlind } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

// Returns whether a raven's claws blinded the hero within a few turns.
async function ravenFight(appearance: string): Promise<boolean> {
    freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 200;
    const descriptions = [...OBJECT_DESCRIPTIONS];
    descriptions[HELMET] = appearance;
    game.objectDescriptions = descriptions;
    wearHeroArmor(await addInventoryObject(HELMET));
    const raven = await createMonsterAt('raven', 11, 10, NO_MINVENT);
    raven.mpeaceful = false;
    pushKeys('m.'.repeat(12) + ' '.repeat(80));
    initRng(5n);
    for (let turn = 0; turn < 12 && !heroIsBlind(game); turn++) await moveloop_core();
    return heroIsBlind(game);
}

void test('a visored helmet keeps a raven from clawing out the hero\'s sight', async () => {
    assert.equal(await ravenFight('plumed helmet'), true, 'an open helmet leaves the eyes exposed');
    assert.equal(await ravenFight('visored helmet'), false);
});
