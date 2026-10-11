import { installPagerInput } from './support/pager-input.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { P_EXPERT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { SPE_TURN_UNDEAD, WAN_UNDEAD_TURNING } from '../js/object_data.js';
import { castSpell } from '../js/spell.js';
import { learnSpell } from './support/spells.js';
import { dozap } from '../js/zap.js';
import { chargedWand, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_TROLL = 220;

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
    requirePlayingGame(game);
}

async function trollCorpse() {
    return await untimedCorpse(PM_TROLL);
}

void test('undead turning revives floor and carried corpses along its path',
    async () => {
        freshState();
        requirePlayingGame(game);
        const floorCorpse = placeCreatedObject(await trollCorpse(), 11, 10);
        const zombie = await createMonsterAt('human zombie', 13, 10);
        zombie.mhp = zombie.mhpmax = 20;
        zombie.m_lev = 4;
        const carriedCorpse = await trollCorpse();
        await addObjectToMonsterInventory(zombie, carriedCorpse);
        const wand = await chargedWand(WAN_UNDEAD_TURNING, { charges: 2 });
        game.inventory.push(wand);
        installPagerInput(resetInputState(), { expected: /troll|zombie|corpse|alive|resurrect/i, limit: 6 });
        pushKeys('al');

        await dozap();

        const trolls = game.level.monsters.filter(monster =>
            monster.mnum === PM_TROLL && monster.mhp > 0);
        assert.equal(trolls.length, 2);
        assert.equal(floorCorpse.where, 'gone');
        assert.equal(carriedCorpse.where, 'gone');
        assert.ok(zombie.mhp >= 12 && zombie.mhp <= 19);
        assert.equal(zombie.mflee, 1);
    });

void test('the turn undead spell revives a carried corpse', async () => {
    freshCasterRoom({ role: 'priest' });
    requirePlayingGame(game);
    const corpse = await trollCorpse();
    corpse.where = 'inventory';
    game.inventory.push(corpse);
    await learnSpell(SPE_TURN_UNDEAD, { skill: P_EXPERT });
    installPagerInput(resetInputState(), { expected: /troll|corpse|alive|resurrect/i, limit: 3 });
    pushKeys('.');

    await castSpell(SPE_TURN_UNDEAD);

    assert.equal(corpse.where, 'gone');
    assert.ok(game.level.monsters.some(monster =>
        monster.mnum === PM_TROLL && monster.mhp > 0));
    assert.equal(game.u.uen, 10);
    assert.equal(game.context.move, 1);
});

void test('a wand of undead turning revives a corpse carried by the hero',
    async () => {
        freshState();
        requirePlayingGame(game);
        const corpse = await trollCorpse();
        corpse.where = 'inventory';
        const wand = await chargedWand(WAN_UNDEAD_TURNING, { charges: 2 });
        game.inventory.push(corpse, wand);
        installPagerInput(resetInputState(), { expected: /troll|corpse|alive|resurrect/i, limit: 3 });
        pushKeys('a.');

        await dozap();

        assert.equal(corpse.where, 'gone');
        assert.equal(wand.spe, 1);
        assert.equal(game.context.move, 1);
});
