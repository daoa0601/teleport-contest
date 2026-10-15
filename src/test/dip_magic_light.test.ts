import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN } from '../js/const.js';
import { GOLD_DRAGON_SCALE_MAIL, TALLOW_CANDLE } from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('fountain water cannot extinguish the magical light of gold dragon armor', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { lamplit: true });
    initRng(6n);

    await runExtendedCommand('dip', armor.invlet + 'y' + ' '.repeat(10));

    assert.equal(armor.lamplit, true);
});

void test('dipping a candle extinguishes its flame before another fountain effect', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const candle = await addInventoryObject(TALLOW_CANDLE, { lamplit: true });
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(6n);

    await runExtendedCommand('dip', candle.invlet + 'y' + ' '.repeat(10));

    assert.equal(candle.lamplit, false);
    assert.match([...messages, game._pending_message].join('\n'), /candle's flame is extinguished/);
});
