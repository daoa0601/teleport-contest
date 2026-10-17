import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SCR_IDENTIFY, TALLOW_CANDLE } from '../js/object_data.js';
import { startHeroSliming } from '../js/slime.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const resistant of [false, true]) {
    void test(`a fire attack burns inventory and lights candles before curing slime${resistant ? ' despite fire resistance' : ''}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, fireResistance: resistant } });
        requirePlayingGame(game);
        const scroll = await addInventoryObject(SCR_IDENTIFY);
        const candle = await addInventoryObject(TALLOW_CANDLE, { age: 100 });
        startHeroSliming({ state: game, turns: 8, killer: 'green slime' });
        const ant = await createMonsterAt('fire ant', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        ant.m_lev = 20;
        ant.mux = game.u.ux;
        ant.muy = game.u.uy;
        const input = resetInputState();
        installPagerInput(input, { expected: /fire ant|fire|scroll|candle|slime|hurt/, limit: 16 });
        const messages = [];
        const fireMessageSliming = [];
        input.beforeRead = () => {
            messages.push(game._pending_message);
            if (game._pending_message.includes("You're on fire!"))
                fireMessageSliming.push(game.u.slimedTurns ?? 0);
        };
        await performMonsterHeroAttack(ant, game, {
            random: limit => limit === 100 ? 99 : 0,
            rollOne: () => 1, rollDice: (count, sides) => count * sides,
        });
        await flushPendingTopline();
        assert.equal(scroll.where, 'gone');
        assert.ok(candle.lamplit, 'the carried candle catches light');
        assert.equal(game.u.slimedTurns, 0);
        assert.equal(game.u.slimeKiller, undefined);
        assert.ok(fireMessageSliming.length > 0, 'the fire message reaches the pager');
        for (const turns of fireMessageSliming)
            assert.equal(turns, 8, 'sliming remains active while inventory damage pages the fire message');
        const prose = messages.join('\n');
        const burning = prose.indexOf('scroll of identify catches fire');
        const lighting = prose.indexOf('candle catches light!');
        const cured = prose.indexOf('The slime that covers you is burned away!');
        assert.ok(burning >= 0 && lighting > burning && cured > lighting, `Inventory destruction and ignition must precede the slime cure:\n${prose}`);
    });
}
for (const cancelled of [false, true]) {
    void test(`${cancelled ? 'cancelled fire preserves slime' : 'fire cures slime'} when inventory escapes the attack`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const candle = await addInventoryObject(TALLOW_CANDLE, { age: 100 });
        startHeroSliming({ state: game, turns: 8, killer: 'green slime' });
        const ant = await createMonsterAt('fire ant', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        ant.m_lev = 1;
        ant.mcan = cancelled;
        ant.mux = game.u.ux;
        ant.muy = game.u.uy;
        const input = resetInputState();
        installPagerInput(input, { expected: /fire ant|fire|slime/, limit: 8 });
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        await performMonsterHeroAttack(ant, game, {
            random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();
        assert.ok(!candle.lamplit, 'the inventory destruction gate also skips ignition');
        assert.equal(game.u.slimedTurns, cancelled ? 8 : 0);
        assert.equal(messages.join('\n').includes('The slime that covers you is burned away!'), !cancelled);
    });
}
//# sourceMappingURL=monster_fire_slime_order.test.js.map