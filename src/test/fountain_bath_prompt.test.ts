import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the urge to bathe needs no extra dismissal when the hero has no gold to lose', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const rock = await addInventoryObject(ROCK);
    resetInputState().display = {
        async readKey() { assert.fail(`Unexpected input after dipping: ${game._pending_message}`); },
    };
    initRng(52n);

    await runExtendedCommand('dip', rock.invlet + 'y');

    assert.match(game._pending_message, /An urge to take a bath overwhelms you/);
    assert.equal(game.context.move, 1);
});

void test('gold is lost before the bath message pauses, while later fountain effects wait', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const rock = await addInventoryObject(ROCK);
    setHeroGoldAmount(game, 100);
    const input = resetInputState();
    const pages: string[] = [];
    const goldAtPager: number[] = [];
    input.display = {
        async readKey() {
            pages.push(game._pending_message);
            goldAtPager.push(heroGoldAmount(game));
            assert.ok(pages.length <= 3, 'One bath, gold-loss, and drying message bound the dip');
            return 32;
        },
    };
    initRng(52n);

    await runExtendedCommand('dip', rock.invlet + 'y');

    assert.equal(pages[0], 'An urge to take a bath overwhelms you.');
    assert.ok(goldAtPager[0] !== undefined && goldAtPager[0] < 100);
});
