import { ensureQuestStatus } from '../js/quest.js';
import { installPagerInput } from './support/pager-input.js';
import { inventoryLetter } from './support/commands.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { see_monsters, canSpotMonster, flushPendingTopline, plineWithContinuation, } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { ddoinv } from '../js/invent.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { setHeroBlindnessTurns, syncDeafness } from '../js/senses.js';
import { restoreGame, saveGame } from '../js/save.js';
import { gotoLevel } from '../js/level_change.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { LAVAPOOL, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, POOL } from '../js/const.js';
import { readObjectName } from '../js/objnam.js';
import { heroLiquidEffects } from '../js/hack.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { AMULET_OF_LIFE_SAVING, CHEST, DAGGER, PICK_AXE, POT_HEALING, POT_WATER, ROCK, SACK, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { applyInventoryObject, dropInventoryObject, throwInventoryObject, runExtendedCommand, invokeInventoryObject, } from './support/commands.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setSecondaryWeapon, setQuiverObject } from '../js/weapon_slots.js';
import { nearCapacity } from '../js/weight.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { answerPrompts } from './support/input-boundaries.js';
function warningRoom(options = {}) {
    freshObjectRoom(options);
    requirePlayingGame(game);
    return captureMessages();
}
function captureMessages() {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
    };
    installPagerInput(input, {
        expected: /You dump some of your gear to lose weight|Pheew!|You fall into the molten lava|You burn to a crisp|You try to crawl out of the water|Your potion of healing dilutes|You are no longer using two weapons|You climb up the stairs|amulet of life saving|But wait|medallion crumbles|You give up your attempt|You fall into the pool|You sink like a rock|You start to float in the air|You begin two-weapon combat|Sting|Orcrist|Grimtooth|Sunsword|Next action|materialize|cold wind|You fall asleep|You wake up|You finish|You feel|You turn into|You return to/,
        limit: 32,
    });
    const pager = input.display;
    assert.ok(pager);
    let finalPages = 0;
    input.display = {
        async readKey() {
            if (game.program_state.gameover) {
                assert.ok(game.nhDisplay);
                const screen = game.nhDisplay.grid
                    .map((row) => row.map((cell) => cell.ch).join(''))
                    .join('\n');
                // Native death summary is followed by one empty message pager.
                if (finalPages === 1 && /^\s*--More--\s*$/.test(screen)) {
                    finalPages++;
                    return ' '.charCodeAt(0);
                }
                if (/REST[\s\S]*IN[\s\S]*PEACE|Goodbye/.test(screen)) {
                    assert.match(screen, /--More--/);
                    assert.ok(++finalPages <= 1, 'death should finish its summary pages');
                    return ' '.charCodeAt(0);
                }
            }
            return pager.readKey();
        },
    };
    return messages;
}
async function gainArtifact(name) {
    ensureQuestStatus().touched_artifact = true;
    const wish = await readObjectName(name, { wizardWish: true });
    assert.ok(wish && !wish.noWish);
    assert.ok(wish.object.oartifact, `wish did not create ${name}`);
    return await addInventoryItem(wish.object);
}
async function targetMonster(name = 'goblin', x = 14, y = 10) {
    return await createMonsterAt(name, x, y, MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT);
}
async function displayedText(messages) {
    await plineWithContinuation('Next action.');
    return [...messages, game._pending_message || ''].join('\n');
}
for (const [artifact, target, color] of [
    ['Sting', 'goblin', 'light blue'],
    ['Orcrist', 'goblin', 'light blue'],
    ['Grimtooth', 'Woodland-elf', 'red'],
]) {
    void test(`${artifact} senses its target only in the primary weapon slot`, async () => {
        const messages = warningRoom();
        requirePlayingGame(game);
        const weapon = await gainArtifact(artifact);
        const monster = await targetMonster(target);
        monster.minvis = true;
        assert.equal(canSpotMonster(monster), false);
        await setSecondaryWeapon(weapon);
        await see_monsters();
        assert.equal(canSpotMonster(monster), false);
        await setQuiverObject(weapon);
        await see_monsters();
        assert.equal(canSpotMonster(monster), false);
        await setPrimaryWeapon(weapon);
        assert.equal(canSpotMonster(monster), true);
        assert.ok((await displayedText(messages)).includes(`${artifact} flickers ${color}!`));
    });
}
void test('a semantic weapon switch reports the old warning stopping before the new warning starts', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('Sting');
    const orcrist = await gainArtifact('Orcrist');
    await targetMonster();
    await setPrimaryWeapon(sting);
    await setPrimaryWeapon(orcrist);
    const text = await displayedText(messages);
    const stop = text.indexOf('Sting stops flickering.');
    const start = text.indexOf('Orcrist flickers light blue!');
    assert.ok(stop >= 0 && start > stop, text);
});
void test('throwing the primary warning weapon reports its warning stopping', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('Sting');
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    assert.equal(canSpotMonster(monster), true);
    await throwInventoryObject(sting, 'h');
    assert.equal(canSpotMonster(monster), false);
    assert.equal(game.uwep, null);
    assert.match(await displayedText(messages), /Sting stops flickering\./);
});
async function takeMessages(messages) {
    await flushPendingTopline();
    return messages.splice(0).join('\n');
}
async function addTargets(count, start = 0) {
    const targets = [];
    for (let i = start; i < start + count; i++) {
        const monster = await targetMonster('goblin', 20 + i, 10);
        monster.msleeping = true;
        targets.push(monster);
    }
    return targets;
}
for (const [artifact, nonTarget] of [
    ['Sting', 'Woodland-elf'],
    ['Orcrist', 'Woodland-elf'],
    ['Grimtooth', 'goblin'],
]) {
    void test(`${artifact} does not warn about unrelated monsters`, async () => {
        const messages = warningRoom();
        requirePlayingGame(game);
        const monster = await targetMonster(nonTarget);
        monster.minvis = true;
        await setPrimaryWeapon(await gainArtifact(artifact));
        assert.equal(canSpotMonster(monster), false);
        assert.equal(await takeMessages(messages), '');
    });
}
void test('warning strength follows the number of targets, including unseen distant sleeping allies', async () => {
    const messages = warningRoom({ right: 65 });
    requirePlayingGame(game);
    await setPrimaryWeapon(await gainArtifact('Sting'));
    const targets = await addTargets(1);
    assert.ok(targets[0]);
    targets[0].minvis = true;
    targets[0].mpeaceful = true;
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting flickers light blue!/);
    targets.push(...(await addTargets(3, 1)));
    await see_monsters();
    assert.equal(await takeMessages(messages), '');
    targets.push(...(await addTargets(1, 4)));
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting glimmers light blue!/);
    targets.push(...(await addTargets(8, 5)));
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting gleams light blue!/);
    await removeMonsterFromGame(targets.pop());
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting glimmers light blue\./);
    while (targets.length > 4)
        await removeMonsterFromGame(targets.pop());
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting flickers light blue\./);
    for (const target of targets)
        await removeMonsterFromGame(target);
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting stops flickering\./);
});
void test('blind warning quivers once, stays quiet as strength changes, and stops quivering', async () => {
    const messages = warningRoom({ right: 65 });
    requirePlayingGame(game);
    setHeroBlindnessTurns(100);
    await setPrimaryWeapon(await gainArtifact('Sting'));
    const targets = await addTargets(1);
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting quivers slightly\./);
    targets.push(...(await addTargets(4, 1)));
    await see_monsters();
    assert.equal(await takeMessages(messages), '');
    for (const target of targets)
        await removeMonsterFromGame(target);
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting stops quivering\./);
});
for (const condition of ['deaf', 'asleep']) {
    void test(`artifact warning remains perceptible while ${condition}`, async () => {
        const messages = warningRoom({ hero: { deafTurns: condition === 'deaf' ? 100 : 0 } });
        requirePlayingGame(game);
        syncDeafness();
        if (condition === 'asleep')
            putHeroToSleep(10);
        await targetMonster();
        await setPrimaryWeapon(await gainArtifact('Sting'));
        assert.match(await takeMessages(messages), /Sting flickers light blue!/);
    });
}
void test('removing object warning preserves the monster form warning source', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    installPolymorphedHero('vampire');
    const elf = await targetMonster('Woodland-elf');
    const orc = await targetMonster('goblin', 15, 10);
    elf.minvis = orc.minvis = true;
    await setPrimaryWeapon(await gainArtifact('Sting'));
    assert.equal(canSpotMonster(elf), true);
    assert.equal(canSpotMonster(orc), true);
    await setPrimaryWeapon(null);
    assert.equal(canSpotMonster(elf), true);
    assert.equal(canSpotMonster(orc), false);
    assert.match(await takeMessages(messages), /Sting stops flickering\./);
});
void test('swapping into an empty secondary slot reports the warning stopping', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('Sting');
    await targetMonster();
    await setPrimaryWeapon(sting);
    await takeMessages(messages);
    await rhack('x'.charCodeAt(0));
    assert.equal(game.uswapwep, sting);
    assert.match(await takeMessages(messages), /Sting stops flickering\./);
});
void test('wielding reports the prospective hand description before activating warning', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('Sting');
    await targetMonster();
    pushKeys(inventoryLetter(sting));
    await rhack('w'.charCodeAt(0));
    const text = await takeMessages(messages);
    const glow = text.indexOf('Sting flickers light blue!');
    const hand = text.indexOf('hand)');
    assert.ok(hand >= 0 && glow > hand, text);
    assert.doesNotMatch(text, /hand, flickering/);
});
for (const blind of [false, true]) {
    void test(`inventory ${blind ? 'hides' : 'shows'} the active glow in the primary hand clause`, async () => {
        warningRoom();
        requirePlayingGame(game);
        await targetMonster();
        await setPrimaryWeapon(await gainArtifact('Sting'));
        if (blind)
            setHeroBlindnessTurns(10);
        const input = resetInputState();
        let inventoryText = '';
        input.beforeRead = () => {
            assert.ok(game.nhDisplay);
            assert.ok(game.nhDisplay);
            inventoryText += game.nhDisplay.grid
                .map((row) => row.map((cell) => cell.ch).join(''))
                .join('\n');
            input.feed(' ');
        };
        await ddoinv();
        assert.match(inventoryText, /Sting/);
        if (blind)
            assert.doesNotMatch(inventoryText, /flickering/);
        else
            assert.match(inventoryText, /hand, flickering light blue\)/);
    });
}
void test('restore keeps the source and senses but announces a fresh warning census', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(await gainArtifact('Sting'));
    await takeMessages(messages);
    game.plname = 'Warning';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Warning', storage), true);
    assert.equal(canSpotMonster(requireGameLevel().monsters[0]), true);
    assert.equal(await takeMessages(messages), '');
    await see_monsters();
    assert.match(await takeMessages(messages), /Sting flickers light blue!/);
    await see_monsters();
    assert.equal(await takeMessages(messages), '');
});
for (const blind of [false, true]) {
    void test(`materialization precedes ${blind ? 'quivering' : 'glowing'} and destination prose`, async () => {
        freshConnectedLevels();
        requirePlayingGame(game);
        const messages = captureMessages();
        await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
        const target = await targetMonster('goblin', 20, 10);
        target.msleeping = true;
        await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });
        await setPrimaryWeapon(await gainArtifact('Sting'));
        const destination = game._levelCache?.get('0:2');
        assert.ok(destination);
        destination.activeSpecialLevel = {
            prototype: 'arrival-message-test',
            file: '',
            specialMessages: ['A cold wind blows from below.'],
        };
        if (blind)
            setHeroBlindnessTurns(100);
        await takeMessages(messages);
        await gotoLevel({ dnum: 0, dlevel: 2 }, {
            arrival: 'random',
            postMessage: 'You materialize on a different level!',
        });
        const text = await takeMessages(messages);
        const materialize = text.indexOf('You materialize');
        const glow = text.indexOf(blind ? 'Sting quivers' : 'Sting flickers');
        const special = text.indexOf('A cold wind');
        assert.ok(materialize >= 0 && glow > materialize && special > glow, text);
        assert.equal(text.match(/You materialize/g)?.length, 1, text);
    });
}
void test('a warning with unchanged strength continues across level travel without restarting', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const messages = captureMessages();
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    (await targetMonster('goblin', 20, 10)).msleeping = true;
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });
    (await targetMonster('goblin', 20, 10)).msleeping = true;
    await setPrimaryWeapon(await gainArtifact('Sting'));
    await takeMessages(messages);
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    assert.doesNotMatch(await takeMessages(messages), /Sting/);
});
void test('hallucinated warning uses an unreal color rather than the artifact color', async () => {
    const messages = warningRoom({ hero: { hallucinationTurns: 100 } });
    requirePlayingGame(game);
    await targetMonster();
    await setPrimaryWeapon(await gainArtifact('Sting'));
    const text = await takeMessages(messages);
    assert.match(text, /Sting flickers [a-z -]+!/);
    assert.doesNotMatch(text, /Sting flickers light blue!/);
});
void test('an active artifact light appears inside the inventory hand clause', async () => {
    warningRoom({ hero: { ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    const sword = await gainArtifact('uncursed Sunsword');
    pushKeys(inventoryLetter(sword));
    await rhack('w'.charCodeAt(0));
    const input = resetInputState();
    let inventoryText = '';
    input.beforeRead = () => {
        assert.ok(game.nhDisplay);
        inventoryText += game.nhDisplay.grid
            .map((row) => row.map((cell) => cell.ch).join(''))
            .join('\n');
        input.feed(' ');
    };
    await ddoinv();
    assert.match(inventoryText, /hand, brightly lit\)/);
});
void test('ordinary arrival feedback stays after the warning, unlike materialization', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const messages = captureMessages();
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    (await targetMonster('goblin', 20, 10)).msleeping = true;
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });
    await setPrimaryWeapon(await gainArtifact('Sting'));
    await takeMessages(messages);
    await gotoLevel({ dnum: 0, dlevel: 2 }, {
        arrival: 'random',
        postMessage: 'The portal closes behind you.',
    });
    const text = await takeMessages(messages);
    const glow = text.indexOf('Sting flickers');
    assert.ok(glow >= 0 && text.indexOf('The portal closes') > glow, text);
});
void test('stashing a wielded artifact ends warning before the put message', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sack = await addInventoryObject(SACK, { contents: [], olocked: false, otrapped: false });
    const sting = await gainArtifact('Sting');
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await takeMessages(messages);
    await applyInventoryObject(sack, `i)\n${sting.invlet}\n`);
    assert.equal(sting.container, sack);
    assert.equal(canSpotMonster(monster), false);
    const text = await takeMessages(messages);
    const stop = text.indexOf('Sting stops flickering.');
    assert.ok(stop >= 0 && text.indexOf('You put') > stop, text);
});
void test('lava burns the wielded wooden artifact and life saving does not keep its warning', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('Sting');
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    await takeMessages(messages);
    await heroLiquidEffects();
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(sting.where, 'gone');
    assert.equal(game.uwep, null);
    assert.equal(canSpotMonster(monster), false);
    assert.match(await takeMessages(messages), /Sting stops flickering\./);
});
void test('a warning artifact broken while forcing a lock loses its sensing without a stop message', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('uncursed +0 Sting');
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await floorObject(CHEST, 10, 10, { olocked: true, otrapped: false, contents: [] });
    await takeMessages(messages);
    await runExtendedCommand('force', 'y');
    initRng(7491n);
    await continueCountedCommand(game);
    assert.equal(sting.where, 'gone');
    assert.equal(game.uwep, null);
    assert.equal(canSpotMonster(monster), false);
    const text = await takeMessages(messages);
    assert.match(text, /broke!/);
    assert.doesNotMatch(text, /Sting stops/);
});
void test('drowning emergency drops remove a warning source before the hero crawls away', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('uncursed +0 Sting');
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await addInventoryObject(ROCK, { quan: 200 });
    game._encumbranceLevel = nearCapacity(game);
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = POOL;
    await takeMessages(messages);
    initRng(5n);
    const outcome = await heroLiquidEffects();
    assert.ok(outcome);
    assert.equal(outcome.moved, true);
    assert.ok(outcome);
    assert.equal(outcome.died, false);
    assert.equal(sting.where, 'floor');
    assert.equal(game.uwep, null);
    assert.equal(canSpotMonster(monster), false);
    assert.match(await takeMessages(messages), /Sting stops flickering\./);
});
void test('readying bare hands describes them before the warning stops', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    await targetMonster();
    await setPrimaryWeapon(await gainArtifact('Sting'));
    await takeMessages(messages);
    pushKeys('-');
    await rhack('w'.charCodeAt(0));
    const text = await takeMessages(messages);
    const hands = text.indexOf('You are bare handed.');
    assert.ok(hands >= 0 && text.indexOf('Sting stops flickering.') > hands, text);
});
void test('swapping warning weapons describes the new primary before changing either warning', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('Sting');
    const orcrist = await gainArtifact('Orcrist');
    await targetMonster();
    await setPrimaryWeapon(sting);
    await setSecondaryWeapon(orcrist);
    await takeMessages(messages);
    await rhack('x'.charCodeAt(0));
    const text = await takeMessages(messages);
    const hand = text.indexOf('hand)');
    const stop = text.indexOf('Sting stops flickering.');
    const start = text.indexOf('Orcrist flickers light blue!');
    assert.ok(hand >= 0 && stop > hand && start > stop, text);
    assert.doesNotMatch(text, /hand, flickering/);
});
for (const lifeSaving of [false, true]) {
    void test(`throwing away invoked levitation ${lifeSaving ? 'resumes after life saving' : 'stops before flight after fatal landing'}`, async () => {
        const messages = warningRoom({ role: 'barbarian' });
        requirePlayingGame(game);
        if (!lifeSaving)
            game.flags.disclose = '-i -a -v -c -o -g';
        const heart = await gainArtifact('The Heart of Ahriman');
        await invokeInventoryObject(heart);
        assert.equal(game.u.levitating, true);
        if (lifeSaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
        await takeMessages(messages);
        await throwInventoryObject(heart, 'h');
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.equal(game.u.levitating, false);
        assert.equal(heart.where, lifeSaving ? 'floor' : 'free');
        assert.equal(game.inventory.includes(heart), false);
    });
}
for (const swap of [false, true]) {
    void test(`${swap ? 'swapping to' : 'wielding'} cursed Orcrist welds before changing warning sources`, async () => {
        const messages = warningRoom();
        requirePlayingGame(game);
        const sting = await gainArtifact('uncursed +0 Sting');
        const orcrist = await gainArtifact('cursed +0 Orcrist');
        orcrist.bknown = false;
        await targetMonster();
        await setPrimaryWeapon(sting);
        if (swap)
            await setSecondaryWeapon(orcrist);
        await takeMessages(messages);
        if (!swap)
            pushKeys(inventoryLetter(orcrist));
        await rhack((swap ? 'x' : 'w').charCodeAt(0));
        assert.equal(game.uwep, orcrist);
        assert.equal(orcrist.bknown, true);
        const text = await takeMessages(messages);
        const weld = text.indexOf('welds itself to your dominant right hand!');
        const stop = text.indexOf('Sting stops flickering.');
        const start = text.indexOf('Orcrist flickers light blue!');
        assert.ok(weld >= 0 && stop > weld && start > stop, text);
        assert.doesNotMatch(text, /weapon in hand/);
    });
}
void test('applying a cursed pick-axe welds it before the old warning stops', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('uncursed +0 Sting');
    const pick = await addInventoryObject(PICK_AXE, { cursed: true, bknown: false });
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await takeMessages(messages);
    const input = resetInputState();
    // The first apply spends its turn wielding; the queued apply asks where to dig.
    await answerPrompts(applyInventoryObject(pick), input, [{
            prompt: /The pick-axe welds itself to your dominant right hand!--More--/,
            keys: ' ',
        }]);
    assert.equal(game.uwep, pick);
    assert.equal(pick.bknown, true);
    assert.equal(canSpotMonster(monster), false);
    assert.equal(game.context.move, 1);
    await answerPrompts(flushPendingTopline(), input, [{
            prompt: /Sting stops flickering\.--More--/,
            keys: ' ',
        }]);
});
void test('wielding a new weapon ends two-weapon combat after describing its warning', async () => {
    const messages = warningRoom({ role: 'barbarian' });
    requirePlayingGame(game);
    const sting = await gainArtifact('uncursed +0 Sting');
    const orcrist = await gainArtifact('uncursed +0 Orcrist');
    await targetMonster();
    await setPrimaryWeapon(sting);
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    await rhack('X'.charCodeAt(0));
    assert.equal(game.u.twoweap, true);
    await takeMessages(messages);
    pushKeys(inventoryLetter(orcrist));
    await rhack('w'.charCodeAt(0));
    assert.equal(game.u.twoweap, false);
    const text = await takeMessages(messages);
    const glow = text.indexOf('Orcrist flickers light blue!');
    assert.ok(glow >= 0 && text.indexOf('You are no longer using two weapons at once.') > glow, text);
});
void test('replacing the secondary weapon also ends two-weapon combat', async () => {
    warningRoom({ role: 'barbarian' });
    requirePlayingGame(game);
    await setPrimaryWeapon(await gainArtifact('uncursed +0 Sting'));
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    const pick = await addInventoryObject(PICK_AXE);
    await rhack('X'.charCodeAt(0));
    assert.equal(game.u.twoweap, true);
    await setSecondaryWeapon(pick);
    assert.equal(game.u.twoweap, false);
    assert.equal(game.uswapwep, pick);
});
void test('a potion dropped while escaping water can dilute again on landing in the pool', async () => {
    warningRoom();
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_HEALING, { odiluted: 0 });
    await addInventoryObject(ROCK, { quan: 200 });
    game._encumbranceLevel = nearCapacity(game);
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = POOL;
    initRng(6n);
    const outcome = await heroLiquidEffects();
    assert.ok(outcome);
    assert.equal(outcome.died, false);
    assert.equal(potion.where, 'floor');
    assert.equal(potion.otyp, POT_WATER);
});
void test('losing hands in a polymorph reports the warning stopping before dropping the weapon', async () => {
    const messages = warningRoom();
    requirePlayingGame(game);
    const sting = await gainArtifact('uncursed +0 Sting');
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await takeMessages(messages);
    await polymonHero(MONSTER_NAME.indexOf('wolf'));
    assert.equal(sting.where, 'floor');
    assert.equal(game.uwep, null);
    assert.equal(canSpotMonster(monster), false);
    assert.match(await takeMessages(messages), /Sting stops flickering\./);
});
for (const lifeSaving of [false, true]) {
    void test(`a polymorph weapon drop ${lifeSaving ? 'continues after life saving' : 'stops after fatal landing'}`, async () => {
        const messages = warningRoom({ role: 'barbarian' });
        requirePlayingGame(game);
        if (!lifeSaving)
            game.flags.disclose = '-i -a -v -c -o -g';
        const heart = await gainArtifact('The Heart of Ahriman');
        if (lifeSaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        await invokeInventoryObject(heart);
        await setPrimaryWeapon(heart);
        assert.equal(game.u.levitating, true);
        requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
        await takeMessages(messages);
        const result = await polymonHero(MONSTER_NAME.indexOf('wolf'));
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.equal(!!result.died, !lifeSaving);
        assert.equal(heart.where, lifeSaving ? 'floor' : 'free');
        assert.equal(game.u.levitating, false);
    });
}
void test('dropping a wielded warning artifact stops its warning before announcing the drop', async () => {
    const messages = warningRoom({ role: 'barbarian' });
    requirePlayingGame(game);
    const sting = await gainArtifact('uncursed +0 Sting');
    const secondary = await addInventoryObject(DAGGER);
    const monster = await targetMonster();
    monster.minvis = true;
    await setPrimaryWeapon(sting);
    await setSecondaryWeapon(secondary);
    await rhack('X'.charCodeAt(0));
    assert.equal(game.u.twoweap, true);
    assert.equal(canSpotMonster(monster), true);
    await takeMessages(messages);
    await dropInventoryObject(sting);
    const output = await takeMessages(messages);
    const stopped = output.indexOf('Sting stops flickering.');
    assert.ok(stopped >= 0 && output.indexOf('You drop ') > stopped, output);
    assert.equal(sting.where, 'floor');
    assert.equal(sting.ox, game.u.ux);
    assert.equal(sting.oy, game.u.uy);
    assert.equal(game.inventory.includes(sting), false);
    assert.equal(game.uwep, null);
    assert.equal(game.uswapwep, secondary);
    assert.equal(game.u.twoweap, false);
    assert.equal(canSpotMonster(monster), false);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=artifact_warning.test.js.map