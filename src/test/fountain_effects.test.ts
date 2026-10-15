import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { LEATHER_ARMOR, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { resolveDippedSensationFate } from '../js/fountain_effects.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('dipping in a fountain can curse a blessed possession', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const rock = await addInventoryObject(ROCK, { blessed: true });
    initRng(1n);

    await runExtendedCommand('dip', rock.invlet + 'y' + ' '.repeat(10));

    assert.equal(rock.blessed, false);
    assert.equal(rock.cursed, true);
});

for (const seed of [74n, 60n, 16n, 91n]) {
    void test(`a fountain removes a curse with draught seed ${seed}`, async () => {
        const level = freshObjectRoom();
        level.requireAt(10, 10).typ = FOUNTAIN;
        const armor = await addInventoryObject(LEATHER_ARMOR, { cursed: true });
        initRng(seed);

        await runExtendedCommand('dip', armor.invlet + 'y' + ' '.repeat(10));

        assert.equal(armor.cursed, false);
        assert.match(game._pending_message, /water glows for a moment/);
    });
}

void test('a blind fountain dip removes a curse without a visible glow', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const armor = await addInventoryObject(LEATHER_ARMOR, { cursed: true });
    setHeroBlindnessTurns(30);
    initRng(74n);

    await runExtendedCommand('dip', armor.invlet + 'y' + ' '.repeat(10));

    assert.equal(armor.cursed, false);
    assert.doesNotMatch(game._pending_message, /glows/);
});

void test('a fountain dip feels like a loss when there is no curse to remove', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const armor = await addInventoryObject(LEATHER_ARMOR);
    initRng(74n);

    await runExtendedCommand('dip', armor.invlet + 'y' + ' '.repeat(10));

    assert.equal(armor.cursed, false);
    assert.match(game._pending_message, /A feeling of loss comes over you/);
});

void test('fate26 resolves the current arm noun into the exact tingling line', async () => {
    freshObjectRoom();
    const effect = resolveDippedSensationFate({
        fate: 26,
        armName: () => 'tentacle',
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'A strange tingling runs up your tentacle.',
    });
});

void test('fate27 does not resolve anatomy for the exact sudden-chill line', async () => {
    freshObjectRoom();
    const effect = resolveDippedSensationFate({
        fate: 27,
        armName() {
            throw new Error('sudden chill must not resolve anatomy');
        },
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'You feel a sudden chill.',
    });
});

void test('sensation reducer leaves adjacent fountain fates to their owners', async () => {
    freshObjectRoom();
    assert.deepEqual(resolveDippedSensationFate({ fate: 25 }), {
        handled: false,
        message: '',
    });
    assert.deepEqual(resolveDippedSensationFate({ fate: 28 }), {
        handled: false,
        message: '',
    });
});
