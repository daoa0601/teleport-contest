import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    SPE_SLOW_MONSTER, WAN_SPEED_MONSTER,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { castSpell } from '../js/spell.js';
import { learnSpell } from './support/spells.js';
import { dozap } from '../js/zap.js';
import { chargedWand } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom, installSwallowedHero } from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

async function createJackal({ peaceful = false, speed = 0 } = {}) {
    const jackal = await createMonsterAt('jackal', 12, 10);
    jackal.mpeaceful = peaceful ? 1 : 0;
    jackal.permspeed = speed;
    jackal.mspeed = speed;
    return jackal;
}


void test('slowing an engulfing cloud releases the hero', async () => {
    freshCasterRoom({ energy: 30 });
    requirePlayingGame(game);
    await learnSpell(SPE_SLOW_MONSTER);
    const cloud = await createMonsterAt('fog cloud', game.u.ux + 1, game.u.uy);
    installSwallowedHero(cloud);
    pushKeys('l                                ');

    await castSpell(SPE_SLOW_MONSTER);

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.ok(cloud.mx !== game.u.ux || cloud.my !== game.u.uy);
    assert.ok(game.u.uen < 30);
});

void test('a speed-monster wand hastens a peaceful target without angering it',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        const monster = await createJackal({ peaceful: true });
        const wand = await chargedWand(WAN_SPEED_MONSTER, { charges: 2 });
        game.inventory = [wand];
        pushKeys('al');

        await dozap();

        assert.equal(monster.mspeed, 2);
        assert.equal(monster.mpeaceful, 1);
        assert.equal(wand.spe, 1);
        assert.equal(wand.typeKnown, true);
    });

void test('slow monster removes permanent speed and angers a peaceful target',
    async () => {
        freshCasterRoom({ energy: 30 });
    requirePlayingGame(game);
        await learnSpell(SPE_SLOW_MONSTER);
        const monster = await createJackal({ peaceful: true, speed: 2 });
        pushKeys('l');

        await castSpell(SPE_SLOW_MONSTER);

        assert.equal(monster.mspeed, 0);
        assert.equal(monster.mpeaceful, 0);
        assert.equal(game.context.move, 1);
    });

void test('slow monster aimed at yourself removes intrinsic speed', async () => {
    freshCasterRoom({ energy: 30 });
    requirePlayingGame(game);
    await learnSpell(SPE_SLOW_MONSTER);
    grantIntrinsicProperty('fast', 'role', game);
    pushKeys('.');

    await castSpell(SPE_SLOW_MONSTER);

    assert.equal(game.u.fast, false);
    assert.equal(game.u.veryFast, false);
    assert.equal(game.context.move, 1);
});

void test('a speed-monster wand aimed down hastens the hero\'s mount', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const steed = await createJackal();
    game.u.usteed = steed;
    const wand = await chargedWand(WAN_SPEED_MONSTER, { charges: 2 });
    game.inventory = [wand];
    pushKeys('a>');

    await dozap();

    assert.equal(steed.mspeed, 2);
    assert.equal(wand.spe, 1);
});
