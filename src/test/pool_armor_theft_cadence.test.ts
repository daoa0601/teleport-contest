import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { moveloop_core, performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { LEATHER_ARMOR, TIN_WHISTLE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { startLuaCore } from './support/lua-game.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';

void test('Lua end-turn effects still reach a hero removing armor for a nymph', async t => {
    freshObjectRoom({ flags: { female: true } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 8 });
    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });
    nymph.movement = -100;
    const core = await startLuaCore(t);
    core.execute(`
        function give_whistle()
            u.giveobj(obj.new("tin whistle"))
        end
        nh.callback("end_turn", "give_whistle")
    `);
    game._moveloopStarted = true;
    game.u.umovement = 12;

    await moveloop_core();

    assert.equal(game.inventory.filter(object => object.otyp === TIN_WHISTLE).length, 1,
        'The Lua gift arrives even though the hero cannot take another command');
    assert.ok(game.inventory.includes(suit), 'The nymph must still wait for armor removal');
});

void test('crawl mode shows five frames for each unfinished armor-theft turn', async () => {
    freshObjectRoom({ flags: { female: true, runmode: 'crawl' } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 8 });
    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });
    nymph.movement = -100;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    let frames = 0;
    game.animationFrame = async () => { frames++; };
    const started = game.moves;

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.moves - started, 1, 'One world turn of suit removal has elapsed');
    assert.ok(game.inventory.includes(suit), 'The suit is not stolen yet');
    assert.equal(frames, 5, 'One helpless world turn has one crawl display delay');
});

