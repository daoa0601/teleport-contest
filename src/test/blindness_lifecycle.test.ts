import { installPagerInput } from './support/pager-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { flushPendingTopline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, TIMEOUT } from '../js/const.js';
import { BLINDFOLD, SCR_IDENTIFY } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { heroIsBlind, setHeroBlindnessTurns } from '../js/senses.js';
import { objectTypeKnown } from '../js/shk.js';
import { pickupAtHero } from '../js/pickup.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';

function sightRoom(options = {}) {
    freshObjectRoom(options);
    requirePlayingGame(game);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
    };
    installPagerInput(input, {
        expected:
            /Your vision seems to dim|[a-zA-Z] - a scroll\.|Sting|blindfold|You decipher|eyes|Eyes|Timeout for|You can see|You cannot see|You can no longer see/,
        limit: 16,
    });
    return messages;
}

async function takeMessages(messages: string[]) {
    await flushPendingTopline();
    return messages.splice(0).join('\n');
}

async function gainArtifact(name: string) {
    const wish = await readObjectName(name, { wizardWish: true });
    assert.ok(wish && !wish.noWish);
    assert.ok(wish.object.oartifact, `wish did not create ${name}`);
    return await addInventoryItem(wish.object);
}

for (const regaining of [false, true]) {
    void test(`applying eyewear ${regaining ? 'restores Sting light feedback' : 'changes Sting to touch feedback'}`, async () => {
        const messages = sightRoom();
        requirePlayingGame(game);
        const sting = await gainArtifact('Sting');
        const blindfold = await addInventoryObject(BLINDFOLD);
        await createMonsterAt('goblin', 14, 10, MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT);
        await setPrimaryWeapon(sting);
        if (regaining) await applyInventoryObject(blindfold);
        assert.equal(heroIsBlind(), regaining);
        await takeMessages(messages);

        await applyInventoryObject(blindfold);

        assert.equal(heroIsBlind(), !regaining);
        assert.match(
            await takeMessages(messages),
            regaining ? /Sting is flickering\./ : /Sting is quivering\./,
        );
    });
}

void test('removing a blindfold lets an Archeologist decipher a scroll picked up unseen', async () => {
    const messages = sightRoom({ role: 'archeologist' });
    requirePlayingGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD);
    await applyInventoryObject(blindfold);
    const scroll = await floorObject(SCR_IDENTIFY, game.u.ux, game.u.uy, {
        known: false,
        typeKnown: false,
        dknown: false,
        bknown: false,
    });
    await pickupAtHero();
    assert.equal(scroll.dknown, false);
    assert.equal(objectTypeKnown(scroll), false);
    await takeMessages(messages);

    await applyInventoryObject(blindfold);

    assert.equal(heroIsBlind(), false);
    assert.equal(scroll.dknown, true);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(game.u.uconduct.literate, 1);
    assert.match(await takeMessages(messages), /You decipher the label on your scroll labeled/);
});

void test('adding a blindness timeout behind a blindfold makes the eyes twitch', async () => {
    const messages = sightRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD);
    await applyInventoryObject(blindfold);
    await takeMessages(messages);

    await runExtendedCommand('wizintrinsic', 'i\n');

    assert.equal(game.u.blindTurns, 30);
    assert.equal(heroIsBlind(), true);
    assert.match(await takeMessages(messages), /Your eyes momentarily twitch\./);
});

void test('the real Eyes mask a new timeout and change its feedback without losing sight', async () => {
    const messages = sightRoom({ role: 'monk', flags: { debug: true } });
    requirePlayingGame(game);
    const eyes = await gainArtifact('The Eyes of the Overworld');
    await applyInventoryObject(eyes);
    assert.equal(game.ublindf, eyes);
    await takeMessages(messages);

    await runExtendedCommand('wizintrinsic', 'i\n');

    assert.equal(game.u.blindTurns, 30);
    assert.equal(heroIsBlind(), false);
    const output = await takeMessages(messages);
    assert.match(output, /Your vision seems to dim for a moment but is normal now\./);
    assert.doesNotMatch(output, /A cloud of darkness/);
});

void test('increasing blindness clamps its duration to the Native timeout limit', async () => {
    const messages = sightRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(TIMEOUT - 5);

    await runExtendedCommand('wizintrinsic', 'i\n');

    assert.equal(game.u.blindTurns, TIMEOUT);
    assert.equal(heroIsBlind(), true);
    assert.doesNotMatch(await takeMessages(messages), /cloud of darkness/);
});
