import assert from 'node:assert/strict';
import test from 'node:test';
import { addBuriedObject, unearthFloorObjectsAt } from '../js/buried_object.js';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BELL_OF_OPENING, BOULDER, DAGGER, DIAMOND, WAN_DIGGING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { installHeroChainedToBuriedBall } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a blessed opening bell announces levitation returning after freeing a buried ball', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('levitation', 'outside');
    const ball = await installHeroChainedToBuriedBall();
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true });
    const input = resetInputState();
    const messages: string[] = [];
    installPagerInput(input, { expected: /bell|float|open|chain/, limit: 10 });
    input.beforeRead = () => { messages.push(game._pending_message ?? ''); };
    input.feed(bell.invlet);

    await rhack('a'.charCodeAt(0));

    assert.equal(game.u.utrap, 0);
    assert.equal(ball.where, 'floor');
    assert.equal(game.u.levitating, true);
    assert.match([...messages, game._pending_message].join(' '), /You start to float in the air!/);
});

void test('unearthing a visible buried object immediately displays it', async () => {
    const level = freshObjectRoom();
    const dagger = await knownObject(DAGGER);
    addBuriedObject(dagger, 12, 10);
    newsym(12, 10);

    await unearthFloorObjectsAt(12, 10);

    assert.equal(dagger.where, 'floor');
    assert.equal(level.requireAt(12, 10).disp_ch, ')');
});

void test('digging beneath a boulder does not inspect treasure before the boulder fills its pit', async () => {
    const level = freshObjectRoom({
        hero: { uhp: 500, uhpmax: 500 }, flags: { verbose: true, pickup: true },
    });
    await floorObject(BOULDER, 10, 10);
    const diamond = await knownObject(DIAMOND);
    addBuriedObject(diamond, 10, 10);
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 1 });
    const input = resetInputState();
    const messages: string[] = [];
    installPagerInput(input, { expected: /wand|pit|hole|blast|Boom|boulder|diamond|carrying|lift|pick up|Things that are here/i, limit: 30 });
    input.beforeRead = () => {
        const topLine = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        messages.push(game._pending_message || topLine);
    };
    input.feed(`${wand.invlet}y`);

    await rhack('a'.charCodeAt(0));

    assert.equal(diamond.where, 'buried');
    assert.ok(level.buriedObjects?.includes(diamond));
    assert.equal(game.inventory.includes(diamond), false);
    assert.doesNotMatch(messages.join(' '), /Things that are here:/);
});
