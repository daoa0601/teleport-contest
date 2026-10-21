import { objectTypeKnown } from '../js/shk.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { heroHasInvoluntaryDelay } from '../js/command_state.js';
import { POOL, ROOM, TT_WEB } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { GOLD_PIECE, SPEED_BOOTS } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('forced hurtling preserves the voluntary movement state and its starting square', async () => {
    freshObjectRoom({ right: 20 });
    game.u.umoved = false;
    game.u.ux0 = 9;
    game.u.uy0 = 10;

    await hurtleHero(1, 0, 2);

    assert.equal(game.u.ux, 12);
    assert.equal(game.u.umoved, false, 'knockback alone must not trigger moving-only fumbling or exertion');
    assert.equal(game.u.ux0, 9, 'forced steps retain the start of the voluntary action');
    assert.equal(game.u.uy0, 10);
});

void test('a knockback cannot shorten an existing sleep', async () => {
    freshObjectRoom({ right: 20 });
    await putHeroToSleep(8);

    await hurtleHero(1, 0, 1);

    assert.equal(game.u.ux, 11);
    assert.equal(game._helplessTurns, 8);
    assert.equal(game._helplessReason, 'moving through the air');
    assert.equal(game._helplessDoneMessage, '');
});

void test('a second knockback cannot shorten time already spent moving through the air', async () => {
    freshObjectRoom({ right: 20 });
    await hurtleHero(1, 0, 2);

    await hurtleHero(1, 0, 1);

    assert.equal(game.u.ux, 13);
    assert.equal(game._helplessTurns, 2);
});

void test('a web anchoring a sleeping hero prevents knockback without waking them', async () => {
    freshObjectRoom();
    await putHeroToSleep(8);
    game.u.utrap = 4;
    game.u.utraptype = TT_WEB;

    await hurtleHero(1, 0, 2);

    assert.equal(game.u.ux, 10);
    assert.equal(game._helplessTurns, 8);
    assert.equal(game._helplessDoneMessage, 'You wake up.');
    assert.ok(game.u.usleep);
});

void test('crawling out after hurtling into water looks at the landing square', async () => {
    const level = freshObjectRoom({ right: 20 });
    game.flags.pickup = false;
    for (let x = 10; x <= 12; x++)
        for (let y = 9; y <= 11; y++)
            if (x !== 10 || y !== 10) level.requireAt(x, y).typ = POOL;
    level.requireAt(12, 10).typ = ROOM;
    await floorObject(GOLD_PIECE, 12, 10, { quan: 46 });
    const lines: string[] = [];
    resetInputState().display = { async readKey() {
        lines.push(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd());
        return 32;
    } };

    await hurtleHero(1, 0, 1);
    lines.push(game._pending_message);

    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.ok(lines.some(line => line.includes('You see here 46 gold pieces.')), lines.join('\n'));
});

void test('hurtling into water releases a swimming hero from the movement delay', async () => {
    const level = freshObjectRoom({ hero: { swimming: true } });
    level.requireAt(11, 10).typ = POOL;
    installPagerInput(resetInputState(), { expected: /fall into the pool of water/, limit: 1 });

    await hurtleHero(1, 0, 1);

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uinwater, 1);
    assert.equal(heroHasInvoluntaryDelay(), false);
});

void test('hurtling into water allows input without finishing boots that are still being donned', async () => {
    const input = freshTurnRoom({ hero: { swimming: true } });
    const level = game.level;
    assert.ok(level);
    level.requireAt(11, 10).typ = POOL;
    const boots = await addInventoryObject(SPEED_BOOTS, { known: false, typeKnown: false });
    installPagerInput(input, { expected: /./, limit: 20 });
    input.feed(`W${boots.invlet}`);
    await moveloop_core();
    assert.equal(boots.known, false);

    await hurtleHero(1, 0, 1);
    await finishAtCommandInput(input, () => moveloop_core(), /.*/);

    assert.equal(game.u.uinwater, 1);
    assert.equal(game.uarmf, boots);
    assert.equal(boots.known, false, 'Clearing the hurtle delay must not complete Boots_on()');
    assert.equal(objectTypeKnown(boots), false);
});

void test('hurtling into water allows input without finishing removal of boots', async () => {
    const input = freshTurnRoom({ hero: { swimming: true } });
    const level = game.level;
    assert.ok(level);
    level.requireAt(11, 10).typ = POOL;
    const boots = await addInventoryObject(SPEED_BOOTS);
    wearHeroArmor(boots);
    installPagerInput(input, { expected: /./, limit: 20 });
    input.feed(`T${boots.invlet}`);
    await moveloop_core();
    assert.equal(game.uarmf, boots);

    await hurtleHero(1, 0, 1);
    await finishAtCommandInput(input, () => moveloop_core(), /.*/);

    assert.equal(game.u.uinwater, 1);
    assert.equal(game.uarmf, boots, 'Clearing the hurtle delay must not complete Boots_off()');
    assert.equal(boots.worn, true);
});

for (const action of ['wear', 'remove']) {
    void test(`prayer replaces interrupted boot ${action} after knockback into water`, async () => {
        const input = freshTurnRoom({ hero: { swimming: true, ualign: { type: 0, record: 10 } } });
        const level = game.level;
        assert.ok(level);
        level.requireAt(11, 10).typ = POOL;
        const boots = await addInventoryObject(SPEED_BOOTS, { known: false, typeKnown: false });
        if (action === 'remove') wearHeroArmor(boots);
        installPagerInput(input, { expected: /./, limit: 20 });
        input.feed(`${action === 'wear' ? 'W' : 'T'}${boots.invlet}`);
        await moveloop_core();
        await hurtleHero(1, 0, 1);
        await finishAtCommandInput(input, () => moveloop_core(), /.*/);
        assert.equal(game.u.uinwater, 1);
        assert.match(inventoryItemDescription(boots), /\(being (?:donned|doffed)\)$/);

        const started = game.moves;
        input.feed('#pray\ny');
        await finishAtCommandInput(input, async () => {
            for (let attempt = 0; attempt < 10; attempt++) {
                await moveloop_core();
                if (!game.context.move) return;
            }
            assert.fail('Prayer did not return to command input');
        }, /.*/);

        assert.equal(game.moves - started, 3);
        assert.equal(game.u.invulnerable, false, 'Prayer must complete');
        assert.ok((game.u.ublesscnt ?? 0) > 0, 'The god must answer the prayer');
        assert.equal(game.uarmf, boots, 'Replacing the callback leaves the boots worn');
        assert.equal(boots.worn, true);
        assert.equal(boots.known, false, 'Prayer must not finish Boots_on() or Boots_off()');
        assert.match(inventoryItemDescription(boots), /\(being worn\)$/);
    });
}
