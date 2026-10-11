import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { MM_ANGRY, NO_MINVENT, POLY_TRAP, WEB } from '../js/const.js';
import { moveloop_core } from '../js/allmain.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { maketrap } from '../js/mklev.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { GOLD_PIECE, RIN_CONFLICT } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const peaceful of [false, true]) {
    void test(`a blocked ${peaceful ? 'peaceful' : 'hostile'} monster can attack the hero under Conflict`, async () => {
        let attacked = false;
        for (let seed = 1; seed <= 16 && !attacked; seed++) {
            freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10,
                hero: { ulevel: 30, uhp: 200, uhpmax: 200 } });
            requirePlayingGame(game);
            await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
            const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | NO_MINVENT);
            goblin.mpeaceful = peaceful;
            goblin.msleeping = 0;
            initRng(BigInt(seed));
            pushKeys(' '.repeat(40));

            await runMonsterAction(goblin, game);

            attacked = game.u.uhp < 200;
            assert.equal(goblin.mx, 11);
            assert.equal(goblin.my, 10);
            assert.equal(goblin.mpeaceful, peaceful);
        }
        assert.ok(attacked, 'Conflict can admit an attack without a successful step');
    });
}

void test('a blocked peaceful monster leaves the hero alone without Conflict', async () => {
    freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10,
        hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = true;
    goblin.msleeping = 0;
    initRng(1n);
    pushKeys(' '.repeat(40));

    await runMonsterAction(goblin, game);

    assert.equal(game.u.uhp, 200);
});

for (const species of ['floating eye', 'kobold']) {
    void test(`a ${species} retains its attack eligibility after a polymorph trap`, async () => {
        const input = freshTurnRoom({ heroLevel: 30,
            left: 10, right: 14, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._screen_output); };
        game.u.uhp = game.u.uhpmax = 2000;
        const monster = await createMonsterAt(species, 14, 10, MM_ANGRY | NO_MINVENT);
        monster.msleeping = 0;
        monster.movement = 12;
        monster.mcan = 1;
        await maketrap(13, 10, POLY_TRAP);
        initRng(203n);
        pushKeys('m.' + ' '.repeat(200) + 'm.');

        await moveloop_core();
        await moveloop_core();

        assert.equal(MONSTER_NAME[monster.mnum], 'yellow dragon');
        assert.equal(messages.some(text => text.includes('The yellow dragon coughs.')),
            species === 'kobold', 'only the actor with an active entry attack tries its new breath');
        assert.equal(game.u.uhp, 2000);
    });
}

for (const blind of [false, true]) {
    void test(`an adjacent ${blind ? 'blind' : 'sighted'} hostile ${blind ? 'can wander instead of attacking' : 'stays to attack'}`, async () => {
        let wandered = false;
        for (let seed = 1; seed <= 32 && !wandered; seed++) {
            freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
            requirePlayingGame(game);
            const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | NO_MINVENT);
            goblin.msleeping = 0;
            goblin.mux = game.u.ux;
            goblin.muy = game.u.uy;
            goblin.mcansee = blind ? 0 : 1;
            goblin.mblinded = blind ? 100 : 0;
            initRng(BigInt(seed));
            pushKeys(' '.repeat(40));

            await runMonsterAction(goblin, game);

            wandered = goblin.mx !== 11 || goblin.my !== 10;
        }
        assert.equal(wandered, blind);
    });
}

for (const heroHasGold of [false, true]) {
    void test(`a gold-carrying leprechaun ${heroHasGold ? 'attacks without trying its trap' : 'tries its trap when the hero has no gold'}`, async () => {
        freshTurnRoom();
        requirePlayingGame(game);
        game.u.uhp = game.u.uhpmax = 200;
        if (heroHasGold) await addInventoryObject(GOLD_PIECE, { quan: 100 });
        const leprechaun = await createMonsterAt('leprechaun', 11, 10, MM_ANGRY | NO_MINVENT);
        leprechaun.msleeping = 0;
        leprechaun.movement = 12;
        await addObjectToMonsterInventory(leprechaun, await knownObject(GOLD_PIECE, { quan: 10 }));
        const web = await maketrap(11, 10, WEB);
        assert.ok(web);
        leprechaun.mtrapped = 1;
        assert.equal(Boolean(web.tseen), false);
        initRng(2n);
        pushKeys('m.' + ' '.repeat(100) + 'm.');

        await moveloop_core();
        await moveloop_core();

        assert.equal(Boolean(web.tseen), !heroHasGold,
            'trying to escape reveals the web under the visible monster');
    });
}

void test('Conflict alone does not send an adjacent Wizard through a trap escape attempt', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 200;
    game.level.flags.stasis_until = game.moves + 10;
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const wizard = await createMonsterAt('Wizard of Yendor', 11, 10, MM_ANGRY | NO_MINVENT);
    wizard.msleeping = 0;
    wizard.movement = 12;
    wizard.mspec_used = 20;
    const web = await maketrap(11, 10, WEB);
    assert.ok(web);
    wizard.mtrapped = 1;
    assert.equal(Boolean(web.tseen), false);
    initRng(2n);
    pushKeys('m.' + ' '.repeat(100) + 'm.');

    await moveloop_core();
    await moveloop_core();

    assert.equal(Boolean(web.tseen), false);
    assert.equal(wizard.mtrapped, 1);
    assert.ok(game.u.uhp < 200, 'the Wizard attacks without entering movement');
});
