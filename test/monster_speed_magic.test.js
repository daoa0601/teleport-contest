import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    SPE_SLOW_MONSTER, WAN_SPEED_MONSTER,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import { chargedWand } from './support/game-objects.js';
import { addMonster } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

const PM_JACKAL = 12;

function addJackal({ peaceful = false, speed = 0 } = {}) {
    return addMonster({
        m_id: 801,
        mnum: PM_JACKAL,
        x: 12, y: 10,
        hitPoints: 8,
        mpeaceful: peaceful ? 1 : 0,
        permspeed: speed,
        mspeed: speed,
    });
}

function slowMonsterSpell() {
    return {
        name: 'slow monster', otyp: SPE_SLOW_MONSTER,
        level: 2, category: 'enchantment', fail: 0,
    };
}

test('a speed-monster wand hastens a peaceful target without angering it',
    async () => {
        freshGameplayRoom();
        const monster = addJackal({ peaceful: true });
        const wand = chargedWand(WAN_SPEED_MONSTER, { charges: 2 });
        game.inventory = [wand];
        pushKeys('al');

        await dozap();

        assert.equal(monster.mspeed, 2);
        assert.equal(monster.mpeaceful, 1);
        assert.equal(wand.spe, 1);
        assert.equal(wand.typeKnown, true);
    });

test('slow monster removes permanent speed and angers a peaceful target',
    async () => {
        freshGameplayRoom({ heroLevel: 8, energy: 30 });
        const monster = addJackal({ peaceful: true, speed: 2 });
        pushKeys('l');

        await castKnownSpell(slowMonsterSpell());

        assert.equal(monster.mspeed, 0);
        assert.equal(monster.mpeaceful, 0);
        assert.equal(game.context.move, 1);
    });

test('slow monster aimed at yourself removes intrinsic speed', async () => {
    freshGameplayRoom({ heroLevel: 8, energy: 30 });
    grantIntrinsicProperty('fast', 'role', game);
    pushKeys('.');

    await castKnownSpell(slowMonsterSpell());

    assert.equal(game.u.fast, false);
    assert.equal(game.u.veryFast, false);
    assert.equal(game.context.move, 1);
});

test('a speed-monster wand aimed down hastens the hero\'s mount', async () => {
    freshGameplayRoom();
    const steed = addJackal();
    game.u.usteed = steed;
    const wand = chargedWand(WAN_SPEED_MONSTER, { charges: 2 });
    game.inventory = [wand];
    pushKeys('a>');

    await dozap();

    assert.equal(steed.mspeed, 2);
    assert.equal(wand.charges.current, 1);
});
