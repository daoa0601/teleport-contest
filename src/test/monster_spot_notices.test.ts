// C hack.c:notice_mon() and notice_all_mons() behind the spot_monsters
// accessibility option (C a11y.mon_notices): postmov() announces a monster
// once per sighting, the vision catch-up names peaceful monsters with their
// own article rules in nearest-first order, and a hider that is only
// telepathically sensed stays quiet.

import test from 'node:test';
import assert from 'node:assert/strict';

import { restoregamePreamble } from '../js/allmain.js';
import { moveMonsterForHeroAttack, performMonsterTurn } from '../js/monmove.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { DOOR, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, HWALL, MM_NOGRP, NO_MINVENT, TELEP_TRAP, VIBRATING_SQUARE, W_SADDLE } from '../js/const.js';
import { canSeeMonster, docrt } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { noticeAllMonsters } from '../js/monster_notices.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { finishTeleportArrival } from '../js/location_effects.js';
import { RIN_CONFLICT, SKELETON_KEY } from '../js/object_data.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { runSegment } from '../js/jsmain.js';
import { gotoLevel } from '../js/level_change.js';
import { jumpHero } from '../js/jumping.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { freshConnectedLevels } from './support/connected-levels.js';

function announcements(): string[] {
    return [...game._messageHistory, game._pending_message].filter(Boolean);
}

void test('spot_monsters announces a moving monster once per sighting', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const jackal = await createMonsterAt('jackal', 14, 10, MM_NOGRP | NO_MINVENT);
    jackal.mpeaceful = 0;
    jackal.msleeping = 0;
    initRng(11n);

    await performMonsterTurn(jackal, game);

    assert.ok(announcements().includes('You see a jackal.'),
        `postmov() announces the first sighting: ${announcements().join(' | ')}`);

    const seen = announcements().length;
    await performMonsterTurn(jackal, game);
    assert.ok(!announcements().slice(seen).includes('You see a jackal.'),
        'the mspotted latch keeps the second turn quiet');
});

for (const trapped of [false, true]) {
    void test(`a first sighting precedes ${trapped ? 'a fatal door explosion' : 'opening a door'}`, async () => {
        const level = await freshObjectRoom({
            left: 10, right: 13, top: 10, bottom: 10,
            flags: { spot_monsters: true, verbose: true },
        });
        requirePlayingGame(game);
        const orc = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
        orc.mpeaceful = 0;
        orc.mflee = 1;
        orc.mfleetim = 20;
        orc.mhp = 1;
        await addObjectToMonsterInventory(orc, await knownObject(SKELETON_KEY));
        const door = level.requireAt(12, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED | (trapped ? D_TRAPPED : 0);
        vision_note_blocker_change(12, 10);
        await vision_recalc(0);
        initRng(1n);
        pushKeys(' '.repeat(30));

        await moveMonsterForHeroAttack(orc);

        const messages = announcements().join(' | ');
        const notice = messages.indexOf('You see an orc.');
        const doorMessage = trapped ? messages.indexOf('KABOOM!!')
            : messages.indexOf('orc unlocks and opens a door.');
        assert.equal(door.doormask, trapped ? D_NODOOR : D_ISOPEN,
            `the monster reached and opened the door: ${messages}`);
        assert.equal(!!orc.dead, trapped, `the door trap kills its opener: ${messages}`);
        assert.ok(notice >= 0 && doorMessage > notice,
            `postmov announces the monster before the door effect: ${messages}`);
    });
}

void test('the vision catch-up announces nearest first and describes peaceful monsters', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const gnome = await createMonsterAt('gnome', 13, 10, NO_MINVENT);
    gnome.mpeaceful = 1;
    const newt = await createMonsterAt('newt', 11, 10, NO_MINVENT);
    newt.mpeaceful = 0;

    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });

    assert.deepEqual(said, ['You see a newt.', 'You see a peaceful gnome.']);
});

void test('a telepathically sensed hider is not announced', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    setHeroBlindnessTurns(100);
    grantIntrinsicProperty('telepathy', 'outside');
    const piercer = await createMonsterAt('rock piercer', 13, 10, NO_MINVENT);
    piercer.mundetected = 1;

    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });

    assert.deepEqual(said, []);
});

void test('a save made after notices ran keeps its latches through restore', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Spot saver';
    game.flags.spot_monsters = true;
    await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    await createMonsterAt('newt', 40, 10, NO_MINVENT);
    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });
    assert.ok(said.includes('You see a jackal.'), 'a monster is spotted before saving');

    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Spot saver', storage), true);
    // dorecover() repaints through docrt(); recompute sight the same way
    // before asking for notices.
    await vision_recalc(0);
    // C savemon() writes the raw struct monst, so the spotted jackal stays
    // spotted after the restore instead of being announced again.
    const afterRestore: string[] = [];
    await noticeAllMonsters(game, async message => { afterRestore.push(message); });
    assert.ok(!afterRestore.includes('You see a jackal.'),
        `the latch survives the save: ${afterRestore.join(' | ')}`);
});

// C monmove.c:314-317: a monster that spends its turn eating never reaches
// postmov(), so its first sighting waits for the next vision recalculation
// instead of being announced by the movement presenter.
void test('an eating monster is not announced by its turn', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const jackal = await createMonsterAt('jackal', 14, 10, MM_NOGRP | NO_MINVENT);
    jackal.mpeaceful = 0;
    jackal.msleeping = 0;
    jackal.meating = 2;
    initRng(11n);

    await performMonsterTurn(jackal, game);

    assert.ok(!announcements().some(message => /^You (see|notice) /.test(message)),
        `a turn without postmov() announces nothing: ${announcements().join(' | ')}`);

    await noticeAllMonsters(game);

    assert.ok(announcements().includes('You see a jackal.'),
        `the visible eating monster is announced by the vision catch-up: ${announcements().join(' | ')}`);
});

void test('a conflicted pet attacks the hero before its first sighting notice', async () => {
    await freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10 });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const cat = await createMonsterAt('housecat', 11, 10, NO_MINVENT);
    initializePet(cat, { state: game });
    game.flags.spot_monsters = true;
    const health = game.u.uhp;
    initRng(11n);
    pushKeys(' '.repeat(40));

    await performMonsterTurn(cat, game);

    const messages = announcements().join(' | ');
    const attack = messages.search(/housecat (hits|bites|misses)/);
    const notice = messages.indexOf('You see your housecat.');
    assert.ok(game.u.uhp < health, `the conflicted pet attacked: ${messages}`);
    assert.ok(attack >= 0 && notice > attack,
        `the attack must precede the notice: ${messages}`);
});

void test('redrawing announces a visible monster after rebuilding sight', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    pushKeys(' '.repeat(20));

    await docrt();

    assert.ok(announcements().includes('You see a jackal.'),
        `docrt notices a visible monster: ${announcements().join(' | ')}`);
});

void test('a redraw announces a previously seen monster when sight returns', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    await noticeAllMonsters(game);
    const beforeRedraw = announcements().join(' | ');
    assert.match(beforeRedraw, /You see a jackal\./);
    pushKeys(' '.repeat(20));

    await docrt();

    const messages = announcements().join(' | ');
    assert.ok(messages.indexOf('You see a jackal.') < messages.lastIndexOf('You see a jackal.'),
        `docrt temporarily removes sight, then announces the new sighting: ${messages}`);
});

void test('restoring announces a monster that was not spotted before saving', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Spot saver';
    game.flags.spot_monsters = true;
    await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Spot saver', storage), true);
    pushKeys(' '.repeat(40));

    await restoregamePreamble();

    assert.ok(announcements().includes('You see a jackal.'),
        `the restore redraw notices the monster: ${announcements().join(' | ')}`);
});

void test('a nested teleport waits for the outer invocation message before noticing monsters', async () => {
    const level = await freshObjectRoom({ flags: { debug: true, tips: false, spot_monsters: true } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30, flags: { hellish: true } })];
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.u.uz = { dnum: 0, dlevel: 29 };
    addTrap(level, TELEP_TRAP, 12, 10);
    addTrap(level, VIBRATING_SQUARE, 14, 10);
    const jackal = await createMonsterAt('jackal', 13, 11, MM_NOGRP | NO_MINVENT);
    jackal.mpeaceful = 0;
    const input = resetInputState();

    const teleport = moveHeroByTeleport(12, 10, game, { finishArrival: finishTeleportArrival });
    await input.waitUntilBlocked();
    for (let page = 0; page < 10 && !game._pending_message.includes('Where do you want to be teleported?'); page++) {
        input.feed(' ');
        await input.waitUntilBlocked();
    }
    assert.match(game._pending_message, /Where do you want to be teleported\?/);
    input.feed('ll.' + ' '.repeat(40));
    await teleport;

    const messages = announcements().join(' | ');
    const vibrationMessage = 'You feel a strange vibration under your feet.';
    const vibration = messages.lastIndexOf(vibrationMessage);
    const notice = messages.indexOf('You see a jackal.');
    assert.equal(game.u.ux, 14, 'the landing trap caused a second teleport');
    assert.ok(messages.indexOf(vibrationMessage) < vibration,
        `both teleport arrivals reached the invocation square: ${messages}`);
    assert.ok(vibration >= 0 && notice > vibration,
        `the outer invocation message must precede the notice: ${messages}`);
});

void test('jumping onto a teleport trap delays notices until both landings finish', async () => {
    const level = await freshObjectRoom({ flags: { debug: true, tips: false, spot_monsters: true } });
    requirePlayingGame(game);
    grantIntrinsicProperty('jumping', 'form');
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30, flags: { hellish: true } })];
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.u.uz = { dnum: 0, dlevel: 29 };
    addTrap(level, TELEP_TRAP, 12, 10);
    addTrap(level, VIBRATING_SQUARE, 14, 10);
    // Keep the jackal out of sight during the jump itself. Native
    // hurtle_step() recalculates vision before teleds() starts blocking.
    for (let x = 7; x <= 16; x++) {
        if (x === 14) continue;
        level.requireAt(x, 12).typ = HWALL;
        vision_note_blocker_change(x, 12);
    }
    const jackal = await createMonsterAt('jackal', 14, 13, MM_NOGRP | NO_MINVENT);
    jackal.mpeaceful = 0;
    await vision_recalc(0);
    assert.equal(canSeeMonster(jackal), false, 'the jackal is first visible at the second landing');
    const input = resetInputState();
    input.feed('ll.');

    const jumping = jumpHero();
    await input.waitUntilBlocked();
    for (let page = 0; page < 10 && !game._pending_message.includes('Where do you want to be teleported?'); page++) {
        input.feed(' ');
        await input.waitUntilBlocked();
    }
    assert.match(game._pending_message, /Where do you want to be teleported\?/);
    input.feed('ll.' + ' '.repeat(40));
    const result = await jumping;

    const messages = announcements().join(' | ');
    const vibration = 'You feel a strange vibration under your feet.';
    assert.equal(result.heroDied, false);
    assert.equal(game.u.ux, 14, 'the jump landed on a trap that caused a second teleport');
    assert.ok(messages.indexOf(vibration) < messages.lastIndexOf(vibration),
        `both landings reached the invocation square: ${messages}`);
    assert.ok(messages.indexOf('You see a jackal.') > messages.lastIndexOf(vibration),
        `the jumping landing must finish before the notice: ${messages}`);
});

for (const mentionMap of [false, true]) {
    void test(`startup ${mentionMap ? 'leaves notices to mention_map' : 'welcomes the hero before noticing the pet'}`, async () => {
        const engine = await runSegment({
            seed: 19,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:Ria,role:Valkyrie,race:human,gender:female,align:neutral,'
                + '!legacy,!tutorial,pettype:dog,spot_monsters'
                + (mentionMap ? ',mention_map' : ''),
            moves: '    ', storage: memoryStorage(),
        });
        try {
            const messages = [...engine.state._messageHistory, engine.state._pending_message].join(' | ');
            const welcome = messages.indexOf('welcome to NetHack');
            const notice = messages.indexOf('You see your little dog.');
            assert.ok(welcome >= 0, `startup delivered its welcome: ${messages}`);
            if (mentionMap) assert.equal(notice, -1, messages);
            else assert.ok(notice > welcome, `the initial redraw waits for the welcome: ${messages}`);
        } finally {
            await engine.lua.destroy();
        }
    });
}

void test('level arrival notices wait for the special level message', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const cached = game._levelCache?.get('0:2');
    assert.ok(cached);
    cached.activeSpecialLevel = {
        prototype: 'test-arrival', file: 'test-arrival.lua',
        specialMessages: ['A cold wind blows from below.'],
    };
    game.level = destination;
    await createMonsterAt('jackal', 14, 10, MM_NOGRP | NO_MINVENT);
    game.level = source;
    pushKeys(' '.repeat(20));

    await gotoLevel({ dlevel: 2 }, { arrival: 'downstairs' });

    const messages = announcements().join(' | ');
    const arrival = messages.indexOf('A cold wind blows from below.');
    const notice = messages.indexOf('You see a jackal.');
    assert.equal(game.level, destination);
    assert.ok(arrival >= 0 && notice > arrival,
        `the arrival redraw waits for the level's message: ${messages}`);
});

// C hack.c:1721-1727: the saddle is suppressed only for a named monster,
// so an unnamed steed is announced as "your saddled pony".
void test('a saddled steed keeps its saddle in the announcement', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const pony = await createMonsterAt('pony', game.u.ux, game.u.uy, NO_MINVENT);
    pony.mtame = 1;
    pony.misc_worn_check = (pony.misc_worn_check ?? 0) | W_SADDLE;
    game.u.usteed = pony;

    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });

    assert.ok(said.includes('You see your saddled pony.'),
        `the unnamed steed is announced with its saddle: ${said.join(' | ')}`);
});
