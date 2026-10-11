import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { M_AP_TYPE, NO_MINVENT, W_WEP } from '../js/const.js';
import { clearMessageWindow, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { runMonsterAction, takeMonsterTurn } from '../js/monmove.js';
import { DAGGER, RIN_CONFLICT, ROCK, UNICORN_HORN } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function screenText(): string {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

async function coveredCobra(x: number, y: number) {
    const cobra = await createMonsterAt('cobra', x, y, NO_MINVENT);
    cobra.mhp = cobra.mhpmax = 100;
    cobra.movement = 0;
    await floorObject(ROCK, x, y);
    assert.equal(await hideMonsterUnder(cobra), true);
    clearMessageWindow();
    return cobra;
}

void test('Conflict reveals a covered defender before the attack is stamped or damages it', async () => {
    freshObjectRoom({ hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const captain = await createMonsterAt('captain', 11, 10, NO_MINVENT);
    await equipMonsterObject(captain, await knownObject(DAGGER, { spe: 5 }), W_WEP);
    const cobra = await coveredCobra(12, 10);
    cobra.msleeping = 1;
    captain.mlstmv = game.moves - 1;
    const previousMove = captain.mlstmv;
    const health = cobra.mhp;
    await plineWithContinuation('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();
    const messages: string[] = [];
    initRng(1n);

    const fighting = runMonsterAction(captain, game);
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true),
        fighting.then(() => false),
    ]);
    try {
        assert.equal(blocked, true, 'discovery must wait for the prior message');
        assert.match(screenText(), /rumbling sound.*--More--/);
        assert.equal(cobra.mundetected, 0, 'the defender is already exposed at discovery');
        assert.equal(cobra.msleeping, 0, 'combat admission silently wakes the defender');
        assert.equal(cobra.mhp, health, 'damage waits for discovery acknowledgement');
        assert.equal(captain.mlstmv, previousMove, 'the interrupted attack has not taken its turn yet');
    } finally {
        input.beforeRead = () => {
            const screen = screenText();
            assert.match(screen, /--More--/, 'combat only requests message acknowledgement');
            messages.push(screen);
            input.feed(' ');
        };
        input.feed(' ');
        await fighting;
    }

    messages.push(game._pending_message);
    assert.match(messages.join('\n'), /You notice the cobra\./);
    assert.equal(captain.mlstmv, game.moves);
    assert.ok(cobra.mhp < health, `the resumed attack should damage the cobra: ${health} -> ${cobra.mhp}`);
});

void test('a helpless Conflict attacker leaves its sleeping defender concealed', async () => {
    freshObjectRoom({ hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const captain = await createMonsterAt('captain', 11, 10, NO_MINVENT);
    const cobra = await coveredCobra(12, 10);
    cobra.msleeping = 1;
    captain.mcanmove = 0;
    captain.mfrozen = 10;
    captain.mlstmv = game.moves - 1;
    const previousMove = captain.mlstmv;
    const health = cobra.mhp;
    initRng(1n);

    await runMonsterAction(captain, game);

    assert.equal(cobra.mundetected, 1);
    assert.equal(cobra.msleeping, 1);
    assert.equal(cobra.mhp, health);
    assert.equal(captain.mlstmv, previousMove);
    assert.equal(game._pending_message, '');
});

for (const defenderKind of ['covered cobra', 'disguised mimic'] as const) {
    void test(`a pet readies its weapon against a ${defenderKind} before its first strike`, async () => {
        freshObjectRoom({ heroX: 18, right: 20 });
        requirePlayingGame(game);
        const captain = await createMonsterAt('captain', 10, 10, NO_MINVENT);
        initializePet(captain);
        // A humanoid pet keeps this usable tool even before wielding it.
        const horn = await knownObject(UNICORN_HORN, { spe: 7, cursed: false });
        assert.equal(await addObjectToMonsterInventory(captain, horn), horn);
        const defender = defenderKind === 'covered cobra'
            ? await coveredCobra(11, 10)
            : await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
        defender.mhp = defender.mhpmax = 100;
        defender.mpeaceful = false;
        defender.movement = 0;
        if (defenderKind === 'disguised mimic') assert.notEqual(M_AP_TYPE(defender), 0);
        const disguise = M_AP_TYPE(defender);
        const appearance = defender.mappearance;
        const health = defender.mhp;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => {
            const screen = screenText();
            assert.match(screen, /--More--/, 'combat only requests message acknowledgement');
            messages.push(screen);
            input.feed(' ');
        };
        initRng(1n);

        const ready = await takeMonsterTurn(captain, game);

        assert.equal(ready.movement.attack?.kind, 'monster-wield');
        assert.equal(captain.mw, horn);
        assert.equal(horn.where, 'minvent');
        assert.equal(defender.mhp, health, 'readying the weapon cannot damage the defender');
        assert.equal(!!defender.mundetected, false, 'concealment is removed before the wield action');
        assert.equal(M_AP_TYPE(defender), disguise, 'a wield-only action leaves a mimic disguised');
        assert.equal(defender.mappearance, appearance);
        assert.equal(captain.mlstmv, game.moves);
        messages.push(game._pending_message);
        assert.match(messages.join('\n'), /wields .*unicorn horn!/);

        game.moves++;
        await takeMonsterTurn(captain, game);

        assert.equal(M_AP_TYPE(defender), 0, 'the first actual attack reveals the disguise');
        assert.ok(defender.mhp < health,
            `the readied weapon should damage the ${defenderKind}: ${health} -> ${defender.mhp}`);
    });
}
