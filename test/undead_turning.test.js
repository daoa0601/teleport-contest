import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { mksobj, place_object, set_corpsenm } from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    CORPSE, SPE_TURN_UNDEAD, WAN_UNDEAD_TURNING,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { stopAllObjectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { castKnownSpell } from '../js/spell.js';
import { turnUndeadInDirection } from '../js/undead_turning.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { dozap } from '../js/zap.js';
import { chargedWand } from './support/game-objects.js';
import { addMonster } from './support/monsters.js';

const PM_TROLL = 220;
const PM_HUMAN_ZOMBIE = 244;

function freshState() {
    resetGame();
    resetInputState();
    game.urole = { key: 'wizard' };
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        uen: 40, uenmax: 40,
        uhunger: 900,
        ualign: { type: 0, record: 0 },
        uconduct: {}, uhave: {},
    };
    game.moves = 40;
    game.mvitals = [];
    game.inventory = [];
    game.flags = {};
    game.context = {};
    game.level = new GameMap();
    for (let x = 7; x <= 18; x++) {
        for (let y = 6; y <= 14; y++) {
            const location = game.level.at(x, y);
            location.typ = ROOM;
            location.lit = true;
        }
    }
    vision_reset_new_level();
    vision_recalc(0);
    initRng(700n);
    init_objects();
}

function trollCorpse() {
    const corpse = mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_TROLL);
    stopAllObjectTimers(corpse);
    return corpse;
}

function addZombie(x, y) {
    return addMonster({
        m_id: 901,
        mnum: PM_HUMAN_ZOMBIE,
        x, y,
        level: 4,
    });
}

test('undead turning revives floor and carried corpses along its path',
    async () => {
        freshState();
        const floorCorpse = place_object(trollCorpse(), 11, 10);
        const zombie = addZombie(13, 10);
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
