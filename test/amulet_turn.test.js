import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MAGIC_PORTAL, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { AMULET_OF_YENDOR } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
void test('a wielded Amulet reports portal heat during ordinary turns', async () => {
    for (const [distance, warmth] of [[3, 'hot!'], [8, 'very warm.'], [12, 'warm.']]) {
        let feltHeat = false;
        for (let seed = 1; seed <= 48 && !feltHeat; seed++) {
            freshObjectRoom({ right: 24 });
            requirePlayingGame(game);
            game.level.flags.rndmongen = false;
            const amulet = await addInventoryObject(AMULET_OF_YENDOR);
            game.uwep = amulet;
            game.u.uhave.amulet = true;
            game.u.uevent = { amulet_wish: true };
            await maketrap(game.u.ux + distance, game.u.uy, MAGIC_PORTAL);
            game._moveloopStarted = true;
            game.u.umovement = 12;
            initRng(BigInt(seed));
            const input = resetInputState();
            const messages = [];
            input.beforeRead = () => { messages.push(game._pending_message); };
            installPagerInput(input, { expected: /Amulet|^$/, limit: 4 });
            input.feed('m.');
            await moveloop_core();
            await finishAtCommandInput(input, moveloop_core, /Amulet|^$/);
            feltHeat = messages.some(message => message.includes(`feels ${warmth}`));
        }
        assert.ok(feltHeat, `The wielded Amulet should feel ${warmth} at distance ${distance}`);
    }
});
void test('carrying the Amulet can wake a distant sleeping Wizard', async () => {
    let wokeWizard = false;
    for (let seed = 1; seed <= 128 && !wokeWizard; seed++) {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        level.requireAt(40, 10).typ = ROOM;
        const wizard = await createMonsterAt('Wizard of Yendor', 40, 10);
        wizard.msleeping = 1;
        wizard.movement = 12;
        game.u.uhave.amulet = true;
        game.u.uevent = { amulet_wish: true };
        game._moveloopStarted = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /creepy|^$/, limit: 4 });
        input.feed('m.');
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /creepy|^$/);
        if (!wizard.msleeping) {
            assert.match(messages.join('\n'), /somebody noticed your taking the Amulet/);
            wokeWizard = true;
        }
    }
    assert.ok(wokeWizard, 'The Amulet should eventually alert a sleeping Wizard');
});
void test('the Amulet senses the most recently created portal on a level', async () => {
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ right: 26 });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        game.uwep = await addInventoryObject(AMULET_OF_YENDOR);
        game.u.uhave.amulet = true;
        game.u.uevent = { amulet_wish: true };
        await maketrap(game.u.ux + 1, game.u.uy, MAGIC_PORTAL);
        await maketrap(game.u.ux + 13, game.u.uy, MAGIC_PORTAL);
        game._moveloopStarted = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Amulet|^$/, limit: 4 });
        input.feed('m.');
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /Amulet|^$/);
        assert.doesNotMatch(messages.join('\n'), /feels (?:hot|warm|very warm)/, 'The newest portal is too far away to warm the Amulet');
    }
});
//# sourceMappingURL=amulet_turn.test.js.map