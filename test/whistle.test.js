import { monsterAtPosition } from '../js/monster_location.js';
import { createRoom, createSpecialLevel, createDungeon } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAR_TRAP, FIRE_TRAP, MON_ENDGAME_MIGR, NO_MINVENT, PIT, ROOM, ROOMOFFSET, STONE, STRAT_WAITFORU, VAULT, } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, BOULDER, LEASH, EUCALYPTUS_LEAF, MAGIC_WHISTLE, TIN_WHISTLE } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { initRng } from '../js/rng.js';
import { objectTypeKnown } from '../js/shk.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { maintainVaultResidence } from '../js/vault.js';
import { moveMonsterNextToHero } from '../js/teleport.js';
import { useWhistle } from '../js/whistle.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function petAt(name, x, y) {
    const pet = await createMonsterAt(name, x, y, NO_MINVENT);
    initializePet(pet);
    return pet;
}
function nextToHero(pet) {
    requirePlayingGame(game);
    return Math.max(Math.abs(pet.mx - game.u.ux), Math.abs(pet.my - game.u.uy)) <= 1;
}
void test('a tin whistle wakes nearby creatures and calls pets without moving or angering them', async () => {
    freshObjectRoom({ right: 60, hero: { ulevel: 1 } });
    requirePlayingGame(game);
    const near = await petAt('little dog', 13, 10);
    const far = await petAt('kitten', 40, 10);
    near.msleeping = far.msleeping = 1;
    near.mstrategy = STRAT_WAITFORU;
    near.mtrack = [{ x: 9, y: 10 }];
    near.mfrozen = 7;
    near.mcanmove = 0;
    const whistle = await addInventoryObject(TIN_WHISTLE);
    resetInputState().feed(' ');
    const result = await useWhistle(whistle);
    assert.equal(result.spentTime, true);
    assert.equal(near.msleeping, 0);
    assert.equal(near.mstrategy & STRAT_WAITFORU, 0);
    assert.ok(near.edog != null, 'Expected near.edog to be initialized');
    assert.equal(near.edog.whistletime, game.moves);
    assert.equal(near.mtrack.length, 0);
    assert.equal(near.mfrozen, 7);
    assert.equal(near.mcanmove, 0);
    assert.equal(near.mx, 13);
    assert.equal(near.mpeaceful, 1);
    assert.equal(far.msleeping, 1);
    assert.ok(far.edog != null, 'Expected far.edog to be initialized');
    assert.equal(far.edog.whistletime, 0);
});
void test('an underwater tin whistle blows bubbles without waking or calling pets', async () => {
    freshObjectRoom({ hero: { ulevel: 1, uinwater: 1 } });
    requirePlayingGame(game);
    const pet = await petAt('little dog', 12, 10);
    pet.msleeping = 1;
    const whistle = await addInventoryObject(TIN_WHISTLE);
    await useWhistle(whistle);
    assert.match(game._pending_message, /blow bubbles through your tin whistle/);
    assert.equal(pet.msleeping, 1);
    assert.ok(pet.edog != null, 'Expected pet.edog to be initialized');
    assert.equal(pet.edog.whistletime, 0);
});
void test('a deaf hero feels air rushing past the nose when using a tin whistle', async () => {
    freshObjectRoom({ hero: { deafTurns: 10 } });
    requirePlayingGame(game);
    const whistle = await addInventoryObject(TIN_WHISTLE);
    await useWhistle(whistle);
    assert.match(game._pending_message, /rushing air tickle your nose/);
});
void test('a cursed ordinary whistle schedules a guard for the next vault turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.rooms.push(createRoom({ lx: 7, hx: 16, ly: 6, hy: 14, rtype: VAULT }));
    game.level.nroom = 1;
    game.level.requireAt(10, 10).roomno = ROOMOFFSET;
    updateHeroRoomMembership(game);
    const whistle = await addInventoryObject(TIN_WHISTLE, { cursed: true });
    await useWhistle(whistle);
    assert.match(game._pending_message, /shrill whistling sound/);
    assert.equal(game.u.uinvault, 29);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(maintainVaultResidence(), true);
});
for (const form of ['killer bee', 'air elemental']) {
    void test(`a ${form} body cannot use a whistle`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        installPolymorphedHero(form);
        const whistle = await addInventoryObject(MAGIC_WHISTLE);
        const result = await useWhistle(whistle);
        assert.equal(result.spentTime, true);
        assert.match(game._pending_message, /incapable of using the whistle/);
    });
}
void test('strangulation prevents a whistle from waking creatures', async () => {
    freshObjectRoom({ hero: { strangledTurns: 10 } });
    requirePlayingGame(game);
    const pet = await petAt('little dog', 12, 10);
    pet.msleeping = 1;
    const whistle = await addInventoryObject(TIN_WHISTLE);
    await useWhistle(whistle);
    assert.equal(pet.msleeping, 1);
    assert.match(game._pending_message, /incapable of using the whistle/);
});
void test('an undiscovered magic whistle becomes known when a visible pet relocates', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('little dog', 15, 10);
    pet.msleeping = 1;
    const whistle = await addInventoryObject(MAGIC_WHISTLE, { typeKnown: false });
    resetInputState().feed(' ');
    await useWhistle(whistle);
    assert.equal(nextToHero(pet), true);
    assert.equal(objectTypeKnown(whistle), true);
    assert.equal(pet.msleeping, 1, 'magic relocation is not an ordinary pet call');
    assert.ok(pet.edog != null, 'Expected pet.edog to be initialized');
    assert.equal(pet.edog.whistletime, 0);
    assert.match(game._pending_message, /vanishes and reappears/);
});
void test('a discovered magic whistle summarizes two relocated pets', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await petAt('little dog', 15, 10);
    const kitten = await petAt('kitten', 14, 12);
    const whistle = await addInventoryObject(MAGIC_WHISTLE);
    await useWhistle(whistle);
    assert.equal(nextToHero(dog), true);
    assert.equal(nextToHero(kitten), true);
    assert.ok(dog.mx !== kitten.mx || dog.my !== kitten.my);
    assert.match(game._pending_message, /Two creatures shift locations/);
});
void test('blind magic whistling relocates pets without discovering the whistle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    const pet = await petAt('little dog', 15, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE, { typeKnown: false });
    await useWhistle(whistle);
    assert.equal(nextToHero(pet), true);
    assert.equal(objectTypeKnown(whistle), false);
});
for (const [name, hero, message] of [
    ['underwater', { uinwater: 1 }, /strange, high-pitched whistling sound/],
    ['deaf', { deafTurns: 10 }, /strange, sharp vibration/],
    ['hallucinating', { hallucinationTurns: 10 }, /normal whistling sound/],
    ['stunned', { stunnedTurns: 10 }, /strange whistling sound/],
]) {
    void test(`a ${name} hero can summon a pet with a magic whistle`, async () => {
        freshObjectRoom({ hero });
        requirePlayingGame(game);
        const pet = await petAt('little dog', 15, 10);
        const whistle = await addInventoryObject(MAGIC_WHISTLE);
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        input.feed(' ');
        await useWhistle(whistle);
        assert.equal(nextToHero(pet), true);
        assert.match(messages.join('\n') + game._pending_message, message);
    });
}
void test('stasis blocks magic pet relocation after the whistle sound', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.flags.stasis_until = game.moves;
    const pet = await petAt('little dog', 15, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE, { typeKnown: false });
    await useWhistle(whistle);
    assert.equal(pet.mx, 15);
    assert.equal(pet.my, 10);
    assert.equal(objectTypeKnown(whistle), false);
    assert.match(game._pending_message, /strange whistling sound/);
});
void test('a cursed magic whistle can teleport the hero to a distant pet', async () => {
    freshObjectRoom({ right: 60 });
    requirePlayingGame(game);
    const pet = await petAt('little dog', 40, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE, { cursed: true });
    initRng(5n);
    const input = resetInputState();
    const blowing = useWhistle(whistle);
    await input.waitUntilBlocked();
    const humming = game._pending_message;
    input.feed(' ');
    await blowing;
    assert.equal(nextToHero(pet), true);
    assert.equal(pet.mx, 40);
    assert.match(humming, /high-pitched humming noise/);
});
void test('a no-teleport level prevents a cursed whistle from teleporting the hero', async () => {
    freshObjectRoom({ right: 60 });
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const pet = await petAt('little dog', 40, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE, { cursed: true });
    initRng(5n);
    await useWhistle(whistle);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(pet.mx, 40);
});
void test('a cursed magic whistle can still summon pets normally', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('little dog', 15, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE, { cursed: true });
    initRng(1n);
    resetInputState().feed(' ');
    await useWhistle(whistle);
    assert.equal(nextToHero(pet), true);
    assert.match(game._pending_message, /shifts location/);
});
void test('magic whistling frees a pet from an old pit and fills it with its boulder', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('little dog', 15, 10);
    pet.mtrapped = 1;
    const pit = addTrap(game.level, PIT, 15, 10);
    const boulder = await floorObject(BOULDER, 15, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE);
    resetInputState().feed(' ');
    await useWhistle(whistle);
    assert.equal(nextToHero(pet), true);
    assert.equal(pet.mtrapped, 0);
    assert.ok(!game.level.traps.includes(pit));
    assert.equal(boulder.where, 'gone');
});
void test('a summoned pet enters a real bear trap at its new square', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('dog', 15, 10);
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10)
                game.level.requireAt(x, y).typ = STONE;
        }
    }
    game.level.requireAt(11, 10).typ = ROOM;
    const trap = addTrap(game.level, BEAR_TRAP, 11, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE);
    resetInputState().feed(' ');
    await useWhistle(whistle);
    assert.equal(pet.mx, 11);
    assert.equal(pet.my, 10);
    assert.equal(pet.mtrapped, 1);
    assert.equal(trap.tseen, true);
    assert.doesNotMatch(game._pending_message, /shifts location/);
});
void test('a pet killed by its summoned destination trap costs one luck and detaches its leash', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('dog', 15, 10);
    pet.mhp = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    pet.mleashed = 1;
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10)
                game.level.requireAt(x, y).typ = STONE;
        }
    }
    game.level.requireAt(11, 10).typ = ROOM;
    addTrap(game.level, FIRE_TRAP, 11, 10);
    const whistle = await addInventoryObject(MAGIC_WHISTLE);
    const luck = game.u.uluck || 0;
    installPagerInput(resetInputState(), {
        expected: /^You produce a strange whistling sound\.$|^A tower of flame erupts from the floor under the dog!$/,
        limit: 2,
    });
    const result = await useWhistle(whistle);
    assert.equal(result.heroDied, false);
    assert.notEqual(monsterAtPosition(game.level, pet.mx, pet.my), pet);
    assert.equal(game.u.uluck, luck - 1);
    assert.equal(leash.leashmon, 0);
    assert.equal(game._pending_message, 'The dog is killed!');
    assert.doesNotMatch(game._pending_message, /shifts location/);
});
void test('a leashed pet retains its real leash when summoned beside the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('little dog', 15, 10);
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id, cursed: true });
    pet.mleashed = 1;
    const whistle = await addInventoryObject(MAGIC_WHISTLE);
    resetInputState().feed(' ');
    await useWhistle(whistle);
    assert.equal(nextToHero(pet), true);
    assert.equal(leash.leashmon, pet.m_id);
    assert.equal(pet.mleashed, 1);
});
void test('a magic whistle leaves a real ridden pony on the hero square', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    const whistle = await addInventoryObject(MAGIC_WHISTLE);
    resetInputState().feed(' ');
    await useWhistle(whistle);
    assert.equal(game.u.usteed, pony);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
});
for (const blind of [false, true]) {
    void test(`a blessed eucalyptus leaf can lose its blessing ${blind ? 'silently while blind' : 'with a brown glow'}`, async () => {
        freshObjectRoom({ hero: { blindTurns: blind ? 10 : 0 } });
        requirePlayingGame(game);
        const leaf = await addInventoryObject(EUCALYPTUS_LEAF, { blessed: true, bknown: false, quan: 3 });
        initRng(172n);
        if (!blind)
            resetInputState().feed(' ');
        await useWhistle(leaf);
        assert.equal(leaf.blessed, false);
        assert.equal(leaf.bknown, !blind);
        assert.equal(leaf.quan, 3);
        assert.equal(leaf.where, 'inventory');
        assert.match(game._pending_message, blind ? /strange whistling sound/ : /eucalyptus leaves glow brown/);
    });
}
void test('an incapable hero can still wear off a blessed eucalyptus leaf after attempting to blow it', async () => {
    freshObjectRoom({ hero: { strangledTurns: 10 } });
    requirePlayingGame(game);
    const leaf = await addInventoryObject(EUCALYPTUS_LEAF, { blessed: true });
    initRng(172n);
    resetInputState().feed(' ');
    await useWhistle(leaf);
    assert.equal(leaf.blessed, false);
    assert.match(game._pending_message, /glows brown/);
});
void test('a blessed eucalyptus leaf summons a pet without being eaten', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('little dog', 15, 10);
    const leaf = await addInventoryObject(EUCALYPTUS_LEAF, { blessed: true });
    initRng(1n);
    resetInputState().feed(' ');
    await useWhistle(leaf);
    assert.equal(nextToHero(pet), true);
    assert.equal(leaf.quan, 1);
    assert.equal(leaf.where, 'inventory');
});
void test('#apply uses a real tin whistle and consumes the action', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const whistle = await addInventoryObject(TIN_WHISTLE);
    await runExtendedCommand('apply', whistle.invlet);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /high whistling sound/);
});
function leaveOnlyOccupiedFloor(monsters) {
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++)
            game.level.requireAt(x, y).typ = STONE;
    }
    game.level.requireAt(game.u.ux, game.u.uy).typ = ROOM;
    for (const monster of monsters)
        game.level.requireAt(monster.mx, monster.my).typ = ROOM;
}
function enterEndgame(level = 3) {
    requirePlayingGame(game);
    game.u.uz = { dnum: 1, dlevel: level };
    game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.fire_level = createSpecialLevel({ dnum: 1, dlevel: 3 });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 20, flags: {} }),
        createDungeon({ dname: 'The Endgame', depth_start: 1, num_dunlevs: 5, flags: {} }),
    ];
}
void test('ordinary overcrowding sends a summoned pet into real limbo', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await petAt('dog', 15, 10);
    leaveOnlyOccupiedFloor([pet]);
    await moveMonsterNextToHero(pet);
    assert.ok(!game.level.monsters.includes(pet));
    assert.ok(game._migratingMonsters != null, 'Expected game._migratingMonsters to be initialized');
    assert.ok(game._migratingMonsters.includes(pet));
    assert.equal(pet.mx, 0);
    assert.ok(pet.migrationDestination != null, 'Expected pet.migrationDestination to be initialized');
    assert.equal(pet.migrationDestination.dlevel, 8);
});
void test('endgame overcrowding replaces a foreign elemental before a home elemental or ordinary monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    enterEndgame();
    const pet = await petAt('dog', 15, 10);
    const home = await createMonsterAt('fire elemental', 13, 10, NO_MINVENT);
    const foreign = await createMonsterAt('air elemental', 14, 10, NO_MINVENT);
    const ordinary = await createMonsterAt('giant ant', 12, 10, NO_MINVENT);
    leaveOnlyOccupiedFloor([pet, home, foreign, ordinary]);
    const x = foreign.mx, y = foreign.my;
    await moveMonsterNextToHero(pet);
    assert.ok(!game.level.monsters.includes(foreign));
    assert.ok(game.level.monsters.includes(home));
    assert.ok(game.level.monsters.includes(ordinary));
    assert.equal(pet.mx, x);
    assert.equal(pet.my, y);
    assert.match(game._pending_message, /feel besieged/);
});
void test('endgame overcrowding preserves the Wizard and migrates the pet to the next plane', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    enterEndgame();
    const pet = await petAt('dog', 15, 10);
    const wizard = await createMonsterAt('Wizard of Yendor', 14, 10, NO_MINVENT);
    leaveOnlyOccupiedFloor([pet, wizard]);
    await moveMonsterNextToHero(pet);
    assert.ok(game.level.monsters.includes(wizard));
    assert.ok(!game.level.monsters.includes(pet));
    assert.ok(game._migratingMonsters != null, 'Expected game._migratingMonsters to be initialized');
    assert.ok(game._migratingMonsters.includes(pet));
    assert.ok(pet.migrationDestination != null, 'Expected pet.migrationDestination to be initialized');
    assert.equal(pet.migrationDestination.dnum, 1);
    assert.equal(pet.migrationDestination.dlevel, 2);
    assert.ok(pet.mstate != null, 'Expected pet.mstate to be initialized');
    assert.ok(pet.mstate & MON_ENDGAME_MIGR);
});
void test('endgame overcrowding preserves an Amulet carrier and removes another eligible monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    enterEndgame();
    const pet = await petAt('dog', 15, 10);
    const carrier = await createMonsterAt('air elemental', 14, 10, NO_MINVENT);
    const victim = await createMonsterAt('giant ant', 13, 10, NO_MINVENT);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(carrier, amulet);
    leaveOnlyOccupiedFloor([pet, carrier, victim]);
    await moveMonsterNextToHero(pet);
    assert.ok(game.level.monsters.includes(carrier));
    assert.ok(carrier.minvent.includes(amulet));
    assert.ok(!game.level.monsters.includes(victim));
    assert.equal(pet.mx, 13);
    assert.equal(pet.my, 10);
});
void test('Astral overcrowding with no eligible victim leaves the pet on its original square', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    enterEndgame(1);
    const pet = await petAt('dog', 15, 10);
    const wizard = await createMonsterAt('Wizard of Yendor', 14, 10, NO_MINVENT);
    leaveOnlyOccupiedFloor([pet, wizard]);
    await moveMonsterNextToHero(pet);
    assert.equal(pet.mx, 15);
    assert.equal(pet.my, 10);
    assert.ok(game.level.monsters.includes(pet));
    assert.equal(game._migratingMonsters?.length || 0, 0);
});
//# sourceMappingURL=whistle.test.js.map