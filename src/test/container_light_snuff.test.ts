import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OIL_LAMP, SACK, WAX_CANDLE } from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const type of [OIL_LAMP, WAX_CANDLE]) {
    void test(`stashing a lit ${type === OIL_LAMP ? 'lamp' : 'candle'} announces its flame going out before insertion`, async () => {
        const level = freshObjectRoom();
        for (let x = 7; x <= 16; x++)
            for (let y = 6; y <= 14; y++) level.requireAt(x, y).lit = false;
        vision_reset();
        const light = await addInventoryObject(type, { age: 200 });
        const sack = await addInventoryObject(SACK, { contents: [] });
        const input = resetInputState();
        installPagerInput(input, { expected: /lamp|candle|flame|sack/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        await applyInventoryObject(light);
        vision_recalc(0);
        assert.equal(cansee(12, 10), true);

        await applyInventoryObject(sack, `s${light.invlet}`);
        vision_recalc(0);

        const prose = [...messages, game._pending_message].join('\n');
        assert.match(prose, type === OIL_LAMP
            ? /The oil lamp goes out![\s\S]*You put .* into the sack/
            : /The candle's flame is extinguished\.[\s\S]*You put .* into the sack/);
        assert.equal(light.where, 'contained');
        assert.ok(sack.contents?.includes(light));
        assert.equal(light.lamplit, false);
        assert.equal(light.age, 200);
        assert.equal(objectTimers(light).length, 0);
        assert.equal(cansee(12, 10), false);
    });
}
