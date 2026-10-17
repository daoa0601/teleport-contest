import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { finishArmorRemoval } from '../js/cmd.js';
import { applyArmorOnEffects, removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { flushPendingTopline } from '../js/display.js';
import { wearEyewear } from '../js/eyewear.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { polymonHero, returnHeroToHumanForm } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { BLINDFOLD, GOLD_DRAGON_SCALES } from '../js/object_data.js';
import { heroIsHallucinating } from '../js/senses.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

function hallucinatingRoom(turns: number) {
    const input = freshTurnRoom({ role: 'knight' });
    requireFixtureGame(game);
    game.u.hallucinationTurns = turns;
    const messages: string[] = [];
    let reads = 0;
    input.beforeRead = () => {
        if (game._pending_message) messages.push(game._pending_message);
        if (++reads > 100) throw new Error(`Unexpected input: ${game._pending_message}`);
    };
    input.display = {
        async readKey() {
            const display = requireGameDisplay();
            const text = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('--More--')) return ' '.charCodeAt(0);
            assert.equal(display.cursorCol, game.u.ux - 1, 'command cursor is on the hero');
            assert.equal(display.cursorRow, game.u.uy + 1, 'command cursor is on the hero');
            return 27;
        },
    };
    return { input, messages };
}

void test('Grayswandir suppresses hallucination only while it is wielded', async () => {
    hallucinatingRoom(20);
    const sword = await addInventoryItem(await artifactObject('Grayswandir'));
    assert.equal(heroIsHallucinating(), true);
    await setPrimaryWeapon(sword);
    assert.equal(heroIsHallucinating(), false);
    await setPrimaryWeapon(null);
    assert.equal(heroIsHallucinating(), true);
});

void test('hallucination wears off while gold dragon scales hide its effects', async () => {
    const { input } = hallucinatingRoom(3);
    const scales = await addInventoryObject(GOLD_DRAGON_SCALES);
    await wearHeroArmor(scales);
    await applyArmorOnEffects(scales);
    assert.equal(heroIsHallucinating(), false);
    for (let turn = 0; turn < 4; turn++) {
        input.feed('m.');
        await moveloop_core();
        await moveloop_core();
        await flushPendingTopline();
    }
    await removeHeroArmor(scales);
    assert.equal(heroIsHallucinating(), false);
});

for (const blindfolded of [false, true] as const) {
    void test(`masked hallucination expiry reports ${blindfolded ? 'itching eyes' : 'normal vision'}`, async () => {
        hallucinatingRoom(0);
        await setPrimaryWeapon(await addInventoryItem(await artifactObject('Grayswandir')));
        if (blindfolded) await wearEyewear(await addInventoryObject(BLINDFOLD));
        const messages: string[] = [];
        const publish = async (text: string) => messages.push(text);
        await makeHallucinated(20, { publish });
        assert.equal(heroIsHallucinating(), false);
        assert.equal(messages.length, 0);
        await makeHallucinated(0, { publish });
        assert.equal(messages.join(' '), blindfolded
            ? 'Your eyes momentarily itch.'
            : 'Your vision seems to flatten for a moment but is normal now.');
        await setPrimaryWeapon(null);
        assert.equal(heroIsHallucinating(), false);
    });
}

void test('adding time to active hallucination has no second onset message', async () => {
    hallucinatingRoom(0);
    const messages: string[] = [];
    const publish = async (text: string) => messages.push(text);
    await makeHallucinated(10, { publish });
    await makeHallucinated(20, { publish });
    assert.equal(messages.join(' '), 'Oh wow!  Everything looks so cosmic!');
    assert.equal(heroIsHallucinating(), true);
});

void test('black-light form hides a hallucination dose without losing its duration', async () => {
    hallucinatingRoom(0);
    requireFixtureGame(game);
    await polymonHero(MONSTER_NAME.indexOf('black light'), {});
    const messages: string[] = [];
    await makeHallucinated(20, { publish: async (text: string) => messages.push(text) });
    assert.equal(heroIsHallucinating(), false);
    // Intrinsic resistance does not suppress make_hallucinated's changed flag.
    assert.equal(messages.join(' '), 'Oh wow!  Everything feels so cosmic!');
    await returnHeroToHumanForm(game);
    assert.equal(heroIsHallucinating(), true);
});

void test('saved Grayswandir still suppresses a dose that resumes on unwielding', async () => {
    hallucinatingRoom(20);
    requireFixtureGame(game);
    await setPrimaryWeapon(await addInventoryItem(await artifactObject('Grayswandir')));
    game.plname = 'Hallu';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Hallu', storage), true);
    assert.equal(heroIsHallucinating(), false);
    await setPrimaryWeapon(null);
    assert.equal(heroIsHallucinating(), true);
});

void test('removing one resistance source gives Native feedback even if another still hides the dose', async () => {
    const { messages } = hallucinatingRoom(20);
    await setPrimaryWeapon(await addInventoryItem(await artifactObject('Grayswandir')));
    const scales = await addInventoryObject(GOLD_DRAGON_SCALES);
    await wearHeroArmor(scales);
    await applyArmorOnEffects(scales);
    await flushPendingTopline();
    messages.length = 0;

    await setPrimaryWeapon(null);
    await flushPendingTopline();

    assert.equal(heroIsHallucinating(), false);
    assert.match(messages.join(' '), /Oh wow!  Everything looks so cosmic!/);
    await removeHeroArmor(scales);
    assert.equal(heroIsHallucinating(), true);
});

void test('a sleeping hero receives no message when a masked dose ends', async () => {
    hallucinatingRoom(20);
    await setPrimaryWeapon(await addInventoryItem(await artifactObject('Grayswandir')));
    putHeroToSleep(3);
    const messages: string[] = [];
    await makeHallucinated(0, { publish: async (text: string) => messages.push(text) });
    assert.equal(messages.join(' '), '');
    assert.equal(heroIsHallucinating(), false);
});

void test('gold armor stops shining before its removal restores hallucination', async () => {
    const { messages } = hallucinatingRoom(20);
    const scales = await addInventoryObject(GOLD_DRAGON_SCALES);
    await wearHeroArmor(scales);
    await applyArmorOnEffects(scales);
    await flushPendingTopline();
    messages.length = 0;

    await finishArmorRemoval(scales);
    await flushPendingTopline();

    const output = messages.join(' ');
    const extinguished = output.indexOf('stops shining.');
    const hallucinating = output.indexOf('Oh wow!');
    assert.ok(extinguished >= 0 && hallucinating > extinguished, output);
    assert.equal(heroIsHallucinating(), true);
});
