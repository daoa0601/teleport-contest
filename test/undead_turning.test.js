import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { place_object } from '../js/floor_object.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { SPE_TURN_UNDEAD, WAN_UNDEAD_TURNING } from '../js/object_data.js';
import { castKnownSpell } from '../js/spell.js';
import { turnUndeadInDirection } from '../js/undead_turning.js';
import { dozap } from '../js/zap.js';
import { chargedWand, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_TROLL = 220;
const PM_HUMAN_ZOMBIE = 244;

function freshState() {
    freshObjectRoom({
        right: 18,
        role: 'wizard',
        hero: {
            uen: 40,
            uenmax: 40,
            uhunger: 900,
        },
        objectInitializationSeed: 700n,
    });
}

function trollCorpse() {
    return untimedCorpse(PM_TROLL);
}

test('undead turning revives floor and carried corpses along its path',
    async () => {
        freshState();
        const floorCorpse = place_object(trollCorpse(), 11, 10);
        const zombie = await createMonsterAt('human zombie', 13, 10);
        zombie.mhp = zombie.mhpmax = 20;
        zombie.m_lev = 4;
        const carriedCorpse = trollCorpse();
        addObjectToMonsterInventory(zombie, carriedCorpse);

        await turnUndeadInDirection('l', {
            source: 'wand',
            random: range => range - 1,
            roll: range => range,
        });

        const trolls = game.level.monsters.filter(monster =>
            monster.mnum === PM_TROLL && monster.mhp > 0);
        assert.equal(trolls.length, 2);
        assert.equal(floorCorpse.where, 'gone');
        assert.equal(carriedCorpse.where, 'gone');
        assert.equal(zombie.mhp, 12);
        assert.equal(zombie.mflee, 1);
    });

test('the turn undead spell revives a carried corpse', async () => {
    freshState();
    const corpse = trollCorpse();
    corpse.where = 'inventory';
    game.inventory.push(corpse);
    const spell = {
        name: 'turn undead', otyp: SPE_TURN_UNDEAD,
        level: 6, category: 'clerical', fail: 0,
    };
    pushKeys('.');

    await castKnownSpell(spell);

    assert.equal(corpse.where, 'gone');
    assert.ok(game.level.monsters.some(monster =>
        monster.mnum === PM_TROLL && monster.mhp > 0));
    assert.equal(game.u.uen, 10);
    assert.equal(game.context.move, 1);
});

test('a wand of undead turning revives a corpse carried by the hero',
    async () => {
        freshState();
        const corpse = trollCorpse();
        corpse.where = 'inventory';
        const wand = chargedWand(WAN_UNDEAD_TURNING, { charges: 2 });
        game.inventory.push(corpse, wand);
        pushKeys('a.');

        await dozap();

        assert.equal(corpse.where, 'gone');
        assert.equal(wand.spe, 1);
        assert.equal(game.context.move, 1);
});
