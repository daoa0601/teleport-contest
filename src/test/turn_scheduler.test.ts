import { ROCK } from '../js/object_data.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import { installPagerInput, finishAtCommandInput } from './support/pager-input.js';
import { planInput } from './support/planned-input.js';
import assert from 'node:assert/strict';

import { finishHeroHelplessness, moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { A_STR, IRONBARS, MFAST, NEED_WEAPON, NEW_MOON, NO_MINVENT, NO_WEAPON_WANTED, PIT, POOL, STONE, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AKLYS, AMULET_OF_LIFE_SAVING, AMULET_OF_STRANGULATION, CLUB, CORPSE, DAGGER, LANCE, LONG_SWORD, OBJECT_NAMES, POT_PARALYSIS, SHIELD_OF_DRAIN_RESISTANCE, WAN_MAGIC_MISSILE,
} from '../js/object_data.js';
import {
    startHeroSickness, startHeroVomiting,
} from '../js/hero_illness.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { addInventoryObject, artifactObject, chargedWand, knownObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { checkMonsterGearNextTurn } from '../js/monworn.js';
import { canSeeMonster } from '../js/display.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setHeroLycanthropy } from '../js/were.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { runExtendedCommand } from './support/commands.js';

void test('walking on a fast horse grants another action in the same world turn', async () => {
    const input = freshTurnRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const horse = await createSaddledSteed('horse');
    await runExtendedCommand('ride', 'l');
    horse.mspeed = horse.permspeed = MFAST;
    horse.movement = 0;
    game.u.umovement = 12;
    game._heroTimePending = false;
    const turn = game.moves;
    input.feed('l.');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.u.ux, 12);
    assert.equal(game.moves, turn + 1);
    assert.ok(game.u.umovement >= 12, 'the horse supplies at least two actions per turn');
});

void test('digestion ends a polymorphed cube turn before the next monster attacks', async () => {
    const remainingHp: number[] = [];
    for (const digestBeforeScheduling of [true, false]) {
        const input = freshTurnRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        const cube = await createMonsterAt('gelatinous cube', 12, 10, NO_MINVENT);
        for (const monster of [giant, cube]) {
            monster.mpeaceful = 0;
            monster.msleeping = 0;
            monster.movement = 12;
        }
        const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('chameleon') });
        await addObjectToMonsterInventory(cube, corpse);
        installPagerInput(input, { expected: /turns into|hill giant/, limit: 8 });
        initRng(11n);

        // Native dochug() returns after digestion. Finishing that action
        // before the actor scan must leave the next attack unchanged.
        if (digestBeforeScheduling) {
            await takeMonsterTurn(cube, game);
            cube.movement = 0;
        }
        game._heroTimePending = true;
        await finishAtCommandInput(input, moveloop_core, /turns into|hill giant/);

        assert.equal(corpse.where, 'gone');
        assert.equal(cube.mnum, MONSTER_NAME.indexOf('imp'));
        assert.equal(cube.movement, 0);
        assert.ok(game.u.uhp < 100, 'the giant must finish its attack after digestion');
        remainingHp.push(game.u.uhp);
    }
    assert.equal(remainingHp[1], remainingHp[0],
        'digestion must not add a curse attempt before the giant attacks');
});

void test('a queued were change waits until the hero wakes up', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const beast = MONSTER_NAME.indexOf('werejackal');
    const human = game.u.umonnum;
    setHeroLycanthropy(beast);
    putHeroToSleep(10);
    game._pendingHeroShapeChange = 'were';

    await moveloop_core();
    await moveloop_core();

    assert.equal(game._helplessTurns, 9);
    assert.equal(game.u.umonnum, human, 'sleep must defer the queued transformation');

    await finishHeroHelplessness('');
    installPagerInput(input, { expected: /turn into|hear/, limit: 8 });
    input.feed('.');
    await moveloop_core();

    assert.equal(game.u.umonnum, beast, 'the deferred transformation resumes after waking');
});

void test('an infected human changes into its were form during ordinary turn maintenance', async () => {
    const input = freshTurnRoom({ seed: 81n });
    requirePlayingGame(game);
    game.datetime = '20010601120000';
    const beast = MONSTER_NAME.indexOf('werejackal');
    setHeroLycanthropy(beast);
    installPagerInput(input, { expected: /turn into|hear|feel|starving|hungry/, limit: 40 });

    for (let turn = 0; turn < 240 && game.u.umonnum !== beast; turn++) {
        input.feed('.');
        await moveloop_core();
    }

    assert.equal(game.u.umonnum, beast, 'ordinary turns must permit the native lycanthropy change');
});

void test('a Knight with movement left can act again without advancing global time', async () => {
    freshTurnRoom({ role: 'knight' });
    requirePlayingGame(game);
    game.u.umovement = 24;
    const turn = game.moves;
    pushKeys('.\x1b');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.moves, turn);
});

void test('a monster\'s poisoned weapon weakens the hero during an ordinary turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    goblin.movement = 12;
    await equipMonsterObject(goblin, await artifactObject('Grimtooth'), W_WEP);
    const strength = game.u.acurr.a[A_STR];
    initRng(2n);
    installPagerInput(input, { expected: /goblin (?:thrusts .*Grimtooth|hits)/, limit: 24 });
    input.feed('m.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /attack was poisoned.*feel weaker/);

    assert.ok(game.u.acurr.a[A_STR] < strength);
});

void test('a water demon uses the enchantment of its actual wielded weapon', async () => {
    const damage = [];
    for (const spe of [0, 8]) {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        game.u.uhp = game.u.uhpmax = 100;
        const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
        demon.mpeaceful = false;
        demon.movement = 12;
        await equipMonsterObject(demon, await knownObject(CLUB, { spe }), W_WEP);
        initRng(2n);
        installPagerInput(input, { expected: /water demon (?:swings .*club|hits|bites)/, limit: 24 });
        input.feed('m.');

        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /water demon (?:hits|bites)/);

        assert.equal(!!game.program_state.gameover, false);
        damage.push(100 - game.u.uhp);
    }
    requirePlayingGame(game);
    assert.ok(damage[0] !== undefined && damage[1] !== undefined);
    assert.ok(damage[1] > damage[0], 'the enchanted club should deal more damage');
});

void test('a healthy hero survives repeated water-demon attacks', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const startingTurn = game.moves;
    game.u.uhp = game.u.uhpmax = 1000;
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.mpeaceful = false;
    demon.movement = 12;
    initRng(2n);

    for (let turn = 0; turn < 3; turn++) {
        installPagerInput(input, { expected: /water demon (?:hits|bites)/, limit: 24 });
        input.feed('m.');
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /water demon (?:hits|bites)/);
    }

    assert.equal(!!game.program_state.gameover, false);
    assert.ok(game.u.uhp > 0 && game.u.uhp < game.u.uhpmax);
    assert.ok(game.moves >= startingTurn + 3, 'three turns should have elapsed');
});

void test('a cockatrice hiss starts petrification during an ordinary turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.flags.moonphase = NEW_MOON;
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
    cockatrice.mpeaceful = false;
    cockatrice.movement = 12;
    initRng(2n);
    installPagerInput(input, { expected: /cockatrice (?:bites|touches)/, limit: 24 });
    input.feed('m.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /hissing.*slowing down/);

    assert.equal(game.u.stonedTurns, 4);
    assert.equal(game.u.stoneKiller, 'cockatrice');
});

void test('a giant knocks a small hero backward during an ordinary turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    installPolymorphedHero('kobold');
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.movement = 12;
    initRng(2n);
    installPagerInput(input, { expected: /hill giant (?:hits|knocks you backward)/, limit: 24 });
    input.feed('m.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /You stagger/);

    assert.ok(game.u.ux < 10);
    assert.ok(game.u.mh < game.u.mhmax);
});

void test('an acid blob splashes a pet that kills it during an ordinary turn', async () => {
    const input = freshTurnRoom({ heroX: 18, right: 20 });
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    initializePet(soldier, { state: game });
    soldier.movement = 12;
    const blob = await createMonsterAt('acid blob', 11, 10, NO_MINVENT);
    blob.mpeaceful = false;
    blob.mhp = 1;
    blob.movement = 0;
    const health = soldier.mhp;
    initRng(2n);
    installPagerInput(input, { expected: /soldier hits the acid blob.*acid blob is killed/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /splashed.*acid/);

    assert.equal(game.level.monsters.includes(blob), false);
    assert.ok(soldier.mhp < health);
});

void test('a floating-eye hero freezes an attacker during an ordinary turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    installPolymorphedHero('floating eye');
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    goblin.movement = 12;
    initRng(2n);
    installPagerInput(input, { expected: /goblin hits/, limit: 24 });
    input.feed('m.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /frozen by your gaze/);

    assert.equal(goblin.mcanmove, 0);
    assert.ok(goblin.mfrozen != null, 'Expected goblin.mfrozen to be initialized');
    assert.ok(goblin.mfrozen > 0);
});

void test('a weapon rusts on the hero\'s monster body during an ordinary turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    installPolymorphedHero('rust monster');
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    goblin.movement = 12;
    const dagger = await knownObject(DAGGER, { spe: 8 });
    await equipMonsterObject(goblin, dagger, W_WEP);
    installPagerInput(input, { expected: /goblin (?:thrusts .*dagger|hits)/, limit: 24 });
    input.feed('m.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /dagger rusts/);

    assert.ok(dagger.oeroded != null, 'Expected dagger.oeroded to be initialized');
    assert.ok(dagger.oeroded > 0);
});

void test('a pet\'s weapon rusts when it hits a rust monster during an ordinary turn', async () => {
    const input = freshTurnRoom({ heroX: 18, right: 20 });
    requirePlayingGame(game);
    const captain = await createMonsterAt('captain', 10, 10, NO_MINVENT);
    initializePet(captain, { state: game });
    captain.movement = 12;
    const dagger = await knownObject(DAGGER, { spe: 8 });
    await equipMonsterObject(captain, dagger, W_WEP);
    const rustMonster = await createMonsterAt('rust monster', 11, 10, NO_MINVENT);
    rustMonster.mpeaceful = false;
    rustMonster.movement = 0;
    installPagerInput(input, { expected: /captain (?:thrusts|hits)|dagger rusts/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /rust monster is killed/);

    assert.ok(dagger.oeroded != null, 'Expected dagger.oeroded to be initialized');
    assert.ok(dagger.oeroded > 0);
});

void test('a giant chooses its club over a sword during its turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 12, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.movement = 12;
    giant.weaponCheck = NEED_WEAPON;
    await addObjectToMonsterInventory(giant, await knownObject(CLUB));
    await addObjectToMonsterInventory(giant, await knownObject(LONG_SWORD));
    installPagerInput(input, { expected: /giant wields .*club/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /giant wields .*club/);

    assert.equal(giant.mw?.otyp, CLUB);
});

void test('a failed weapon switch costs the monster its turn and leaves its welded weapon held', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 12, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.movement = 12;
    giant.weaponCheck = NEED_WEAPON;
    const sword = await equipMonsterObject(giant,
        await knownObject(LONG_SWORD, { cursed: true, bknown: false }), W_WEP);
    await addObjectToMonsterInventory(giant, await knownObject(CLUB));
    const health = game.u.uhp;
    installPagerInput(input, { expected: /giant tries to wield .*club/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /long sword is welded/);

    assert.equal(giant.mw?.o_id, sword.o_id);
    assert.equal(sword.bknown, true);
    assert.equal(giant.weaponCheck, NO_WEAPON_WANTED);
    assert.equal(game.u.uhp, health);
});

void test('a caged soldier spends a turn wielding its lance before striking through the bars', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 12, 11, NO_MINVENT);
    soldier.mpeaceful = false;
    soldier.movement = 12;
    soldier.weaponCheck = NEED_WEAPON;
    const lance = await addObjectToMonsterInventory(soldier, await knownObject(LANCE, { spe: 3 }));
    assert.ok(lance);
    for (let x = 11; x <= 13; x++) {
        for (let y = 10; y <= 12; y++) {
            if (x !== 12 || y !== 11) game.level.requireAt(x, y).typ = IRONBARS;
        }
    }
    vision_reset();
    vision_recalc(0);
    const health = game.u.uhp;
    pushKeys('...');

    await moveloop_core();
    await moveloop_core();

    assert.equal(soldier.mw, lance);
    assert.equal(game.u.uhp, health, 'wielding the lance should use the first turn');

    await moveloop_core();

    assert.ok(game.u.uhp < health, 'the next turn should strike through the bars');
    assert.equal(soldier.mw, lance);
    assert.ok(soldier.minvent.includes(lance));
});

void test('a soldier throws and recovers its tethered club during an ordinary turn', async () => {
    freshTurnRoom({ top: 10, bottom: 10 });
    requirePlayingGame(game);
    vision_recalc(0);
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    soldier.mpeaceful = false;
    soldier.movement = 12;
    soldier.weaponCheck = NEED_WEAPON;
    const aklys = await addObjectToMonsterInventory(soldier, await knownObject(AKLYS, { spe: 3 }));
    const health = game.u.uhp;
    pushKeys('.');
    await moveloop_core();

    // Acknowledge the wielding message, then wait for the next turn.
    pushKeys(' .');
    await moveloop_core();
    assert.ok(aklys != null, 'Expected aklys to be initialized');
    assert.equal(soldier.mw?.o_id, aklys.o_id);
    assert.equal(game.u.uhp, health);

    // Acknowledge the throw and return messages, then wait again.
    pushKeys(' .');
    await moveloop_core();

    assert.ok(game.u.uhp < health, 'the thrown club should hurt the hero');
    assert.equal(soldier.mw?.o_id, aklys.o_id);
    assert.equal(aklys.where, 'minvent');
});

void test('a monster can put on an invisibility cloak during its turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    soldier.mpeaceful = 1;
    soldier.movement = 12;
    const cloak = await addObjectToMonsterInventory(soldier,
        await knownObject(OBJECT_NAMES.indexOf('cloak of invisibility')));
    checkMonsterGearNextTurn(soldier);
    installPagerInput(input, { expected: /soldier puts on .*cloak of invisibility/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /cannot see the soldier/);

    assert.ok(cloak != null, 'Expected cloak to be initialized');
    assert.equal(cloak.worn, true);
    assert.equal(canSeeMonster(soldier), false);
    assert.equal(soldier.mx, 12);
    assert.equal(soldier.my, 10);
});


void test('a giant escapes its pit and continues moving during a game turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 13, 10);
    giant.mpeaceful = 1;
    giant.mtrapped = 1;
    giant.movement = 12;
    const trap = addTrap(game.level, PIT, 13, 10);
    installPagerInput(input, { expected: /giant climbs easily out of the pit/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /giant climbs easily out of the pit/);

    assert.equal(giant.mtrapped, 0);
    assert.equal(trap.tseen, true);
    assert.ok(giant.mx !== 13 || giant.my !== 10);
});

void test('an engulfing monster releases the hero when its hold expires during a turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const cloud = await createMonsterAt('fog cloud', game.u.ux + 1, game.u.uy);
    cloud.movement = 12;
    installSwallowedHero(cloud, 1);
    installPagerInput(input, { expected: /moisture.*get expelled/, limit: 24 });
    input.feed('.');

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /^$/);

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.ok(cloud.mx !== game.u.ux || cloud.my !== game.u.uy);
});

void test('strangulation advances during world turns and pauses during prayer', async () => {
    const inputGate = freshTurnRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_STRANGULATION);
    const wearing = wearHeroAccessory(amulet, 'uamul');
    try {
        await inputGate.waitUntilBlocked();
        assert.equal(game.uamul, amulet);
        assert.equal(game.u.strangledTurns, 6);
        assert.match(game._pending_message, /amulet of strangulation \(being worn\)/);
    } finally {
        pushKeys(' '); // Finish native on_msg before the constriction announcement.
        await wearing;
    }
    pushKeys('h');

    await moveloop_core();
    const secondMove = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.strangledTurns, 5);
    game.u.invulnerable = true;
    pushKeys('h');
    await secondMove;
    const nextCommand = moveloop_core();
    await inputGate.waitUntilBlocked();
    assert.equal(game.u.strangledTurns, 5);
    pushKeys('\x1b');
    await nextCommand;
});

void test('helplessness advances through live global turns',
    async () => {
        const inputGate = freshTurnRoom();
        requirePlayingGame(game);
        await addInventoryObject(POT_PARALYSIS, {
            initialize: false,
            invlet: 'a',
            name: 'potion of paralysis',
            plural: 'potions of paralysis',
        });
        installPagerInput(inputGate, { expected: /feet are frozen|can move again/, limit: 4 });
        inputGate.feed('qa');

        await moveloop_core();
        await finishAtCommandInput(inputGate, async () => {
            for (let cycle = 0; cycle < 60 && game._helplessTurns; cycle++)
                await moveloop_core();
        }, /can move again/);

        assert.equal(game._helplessTurns, 0);
        assert.match(game._last_message, /You can move again\.$/);
    });

void test('a burdened hero waits for a complete movement ration',
    async () => {
        const inputGate = freshTurnRoom();
        requirePlayingGame(game);
        // Strength 10 + Constitution 10 carries 550 units.  A 600-unit
        // payload is Burdened, so each global allocation grants 9 rather than
        // 12 movement points.  One wait therefore needs two world turns.
        await addInventoryObject(ROCK, { quan: 60 });
        const before = { moves: game.moves, hunger: game.u.uhunger };
        installPagerInput(inputGate, { expected: /movements are slowed/, limit: 12 });
        inputGate.feed('.');

        await moveloop_core();
        await finishAtCommandInput(inputGate, moveloop_core, /movements are slowed/);

        assert.equal(game.moves, before.moves + 2);
        assert.equal(game.u.uhunger, before.hunger - 2);
    });

void test('a stationary monster in water is checked during world maintenance',
    async () => {
        const inputGate = freshTurnRoom();
        requirePlayingGame(game);
        game.level.requireAt(12, 10).typ = POOL;
        const oracle = await createMonsterAt('Oracle', 12, 10);
        oracle.mpeaceful = 1;
        oracle.movement = 0;
        installPagerInput(inputGate, { expected: /drown the Oracle|murderer|Welcome to experience/, limit: 12 });
        inputGate.feed('.');

        await moveloop_core();
        await finishAtCommandInput(inputGate, moveloop_core, /drown the Oracle/);

        assert.equal(game.level.monsters.includes(oracle), false);
        assert.equal(game.u.uconduct.killer, 1);
        assert.match(game._last_message, /You drown the Oracle\./);
    });

void test('a monster-fired magic missile can kill another monster', async () => {
    const inputGate = freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const target = await createMonsterAt('jackal', 13, 10);
    target.mhp = 1;
    target.mhpmax = 1;
    target.mpeaceful = 1;
    target.mcanmove = 0;
    target.mfrozen = 100;
    const wand = await knownObject(WAN_MAGIC_MISSILE, { spe: 2 });
    const wizard = await createMonsterAt(
        'gnomish wizard', 14, 10, NO_MINVENT,
    );
    wizard.movement = 12;
    wizard.mwandexp = true;
    wizard.mux = game.u.ux;
    wizard.muy = game.u.uy;
    await addObjectToMonsterInventory(wizard, wand);
    for (const [x, y] of [
        [13, 9], [14, 9], [15, 9],
        [13, 11], [14, 11], [15, 10], [15, 11],
    ] as const) game.level.requireAt(x, y).typ = STONE;
    installPagerInput(inputGate, { expected: /gnomish wizard zaps.*magic missile|jackal is killed by the magic missile|magic missile hits you/, limit: 12 });
    inputGate.feed('.');

    await moveloop_core();
    await finishAtCommandInput(inputGate, moveloop_core, /gnomish wizard|magic missile|^$/);

    assert.equal(game.level.monsters.includes(target), false);
});

void test('poison clouds act after old blindness expires for the turn', async () => {
    const inputGate = freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 40;
    game.u.blindTurns = 1;
    game.blind = true;
    game.level.regions = [{
        kind: 'gas-cloud',
        visible: true,
        damage: 8,
        ttl: 3,
        heroFault: false,
        cells: [{ x: game.u.ux, y: game.u.uy }],
    }];
    installPagerInput(inputGate, { expected: /You can see again.*eyes sting.*burning your lungs/, limit: 12 });
    inputGate.feed('.');

    await moveloop_core();
    await finishAtCommandInput(inputGate, moveloop_core, /cough and spit blood/);

    assert.ok(game.u.uhp < 40);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(game.blind, true);
    assert.ok(game.level.regions[0] != null);
    assert.equal(game.level.regions[0].ttl, 2);
});

void test('slime infection advances during an ordinary world turn', async () => {
    const inputGate = freshTurnRoom();
    requirePlayingGame(game);
    startHeroSliming({ state: game, turns: 7, killer: 'green slime' });
    pushKeys('h');

    await moveloop_core();
    const nextInput = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.slimedTurns, 6);
    assert.match(game._pending_message, /Your limbs are getting oozy\.$/);
    pushKeys(' ');
    await nextInput;
});

void test('petrification advances during an ordinary world turn', async () => {
    const inputGate = freshTurnRoom();
    requirePlayingGame(game);
    startHeroPetrification({ state: game, killer: 'cockatrice egg' });
    pushKeys('h');

    await moveloop_core();
    const nextInput = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.stonedTurns, 4);
    assert.match(game._pending_message, /You are slowing down\.$/);
    pushKeys(' ');
    await nextInput;
});

void test('fatal sickness advances during an ordinary world turn', async () => {
    const inputGate = freshTurnRoom();
    requirePlayingGame(game);
    await startHeroSickness({
        state: game,
        turns: 7,
        cause: 'rotted goblin corpse',
    });
    pushKeys('h');

    await moveloop_core();
    const nextInput = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.sickTurns, 6);
    assert.match(game._pending_message, /Your sickness feels worse\.$/);
    pushKeys(' ');
    await nextInput;
});

void test('nausea advances before sickness during an ordinary world turn',
    async () => {
        const inputGate = freshTurnRoom();
        requirePlayingGame(game);
        startHeroVomiting({ state: game, turns: 15 });
        await startHeroSickness({
            state: game,
            turns: 7,
            cause: 'tainted meat',
        });
        pushKeys('h');

        await moveloop_core();
        const nextInput = moveloop_core();
        await inputGate.waitUntilBlocked();

        assert.equal(game.u.vomitingTurns, 14);
        assert.equal(game.u.sickTurns, 6);
        assert.match(
            game._pending_message,
            /mildly nauseated.*sickness feels worse/,
        );
        pushKeys(' ');
        await nextInput;
    });

for (const lifesaving of [false, true]) {
    void test(`a wraith's level-one touch ${lifesaving ? 'resumes the original hit after life saving' : 'kills through level drain before the original hit'}`, async t => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        game.u.uhp = game.u.uhpmax = 100;
        game.u.uexp = 5;
        const wraith = await createMonsterAt('wraith', 11, 10, NO_MINVENT);
        wraith.mpeaceful = false;
        wraith.movement = 12;
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        if (lifesaving) {
            installPagerInput(input, { expected: /wraith touches|Farvel level|You die|medallion|feel much better/, limit: 8 });
        } else {
            assert.equal(game.inventory.length, 0);
            planInput(input, t, [
                { prompt: /wraith touches.*Farvel level/, keys: ' ' },
                { prompt: /You die\.\.\..*--More--/, keys: ' ' },
                { prompt: /see your attributes\?/, keys: 'n' },
                { prompt: /see your conduct\?/, keys: 'n' },
                { prompt: /dungeon overview\?/, keys: 'n' },
                { prompt: /Farvel player the Valkyrie/, keys: ' ' },
                { prompt: /^\s*--More--\s*$/, keys: ' ' },
            ]);
        }
        input.feed('m.');
        initRng(2n);

        await moveloop_core();
        if (lifesaving) {
            await finishAtCommandInput(input, moveloop_core, /survived that attempt on your life/);
        } else await moveloop_core();

        assert.equal(!!game.program_state.gameover, !lifesaving);
        if (lifesaving) {
            assert.equal(game.u.uexp, 0);
            assert.ok(game.u.uhp > 0 && game.u.uhp < game.u.uhpmax,
                'the contact hit still follows a survived level drain');
        } else assert.equal(game._deathKiller, 'life drainage');
    });
}

void test('a shield of drain resistance blocks level loss from an actual wraith touch', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    game.u.uexp = 5;
    const shield = await addInventoryObject(SHIELD_OF_DRAIN_RESISTANCE);
    wearHeroArmor(shield);
    await applyArmorOnEffects(shield);
    const wraith = await createMonsterAt('wraith', 11, 10, NO_MINVENT);
    wraith.mpeaceful = false;
    wraith.movement = 12;
    installPagerInput(input, { expected: /wraith touches you/, limit: 24 });
    input.feed('m.');
    initRng(2n);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /wraith touches you/);

    assert.ok(!game.program_state.gameover);
    assert.equal(game.u.ulevel, 1);
    assert.equal(game.u.uexp, 5);
    assert.ok(game.u.uhp < 100, 'the touch landed despite the shield');
});
