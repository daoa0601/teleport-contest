import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { initRng } from '../js/rng.js';

const BEC_DE_CORBIN = 70;

async function wield(otyp: number, artifactName: string | null = null): Promise<void> {
    const weapon = await addInventoryObject(otyp);
    if (artifactName) {
        const artifact = artifactByName(artifactName);
        assert.ok(artifact);
        nameArtifact(weapon, artifact);
    }
    game.uwep = game.u.uwep = weapon;
}

// makemon.c: a demon prince who demands bribes is born peaceful and
// permanently invisible, unless the hero wields Excalibur or Demonbane.
void test('Baalzebub is born peaceful and invisible to an unarmed hero', async () => {
    freshTurnRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const prince = await createMonsterAt('Baalzebub', 13, 10);
    assert.equal(!!prince.mpeaceful, true);
    assert.equal(!!prince.minvis, true);
    assert.equal(!!prince.perminvis, true);
});

void test('Baalzebub is born hostile to a hero wielding Demonbane', async () => {
    freshTurnRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const demonbane = artifactByName('Demonbane');
    assert.ok(demonbane);
    await wield(demonbane.baseType, 'Demonbane');
    const prince = await createMonsterAt('Baalzebub', 13, 10);
    assert.equal(!!prince.mpeaceful, false);
    assert.equal(!!prince.minvis, true, 'the bane changes peacefulness, not invisibility');
});

void test('a raven is born peaceful to a hero wielding a bec de corbin', async () => {
    freshTurnRoom({ role: 'valkyrie' });
    requirePlayingGame(game);
    await wield(BEC_DE_CORBIN);
    const raven = await createMonsterAt('raven', 13, 10);
    assert.equal(!!raven.mpeaceful, true);
});

// makemon.c species switch: a unicorn whose alignment sign matches the
// hero's is born peaceful, overriding peace_minded()'s random hostility.
void test('a co-aligned unicorn is always born peaceful', async () => {
    for (let seed = 1; seed <= 24; seed++) {
        freshTurnRoom({ role: 'wizard' });
        requirePlayingGame(game);
        initRng(BigInt(seed));
        game.u.ualign.type = 0;
        game.u.ualign.record = 0;
        const unicorn = await createMonsterAt('gray unicorn', 13, 10);
        assert.equal(!!unicorn.mpeaceful, true, `seed ${seed}`);
    }
});

void test('a cross-aligned unicorn is born hostile', async () => {
    freshTurnRoom({ role: 'wizard' });
    requirePlayingGame(game);
    game.u.ualign.type = 1;
    const unicorn = await createMonsterAt('gray unicorn', 13, 10);
    assert.equal(!!unicorn.mpeaceful, false);
});
