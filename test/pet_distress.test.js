import test from 'node:test';
import assert from 'node:assert/strict';
import { buryObject } from '../js/buried_object.js';
import { rhack } from '../js/cmd.js';
import { CORPSTAT_INIT, ICE, ICED_POOL, POOL } from '../js/const.js';
import { digHole } from '../js/digging_terrain.js';
import { canSeeMonster, canSpotMonster, flush_screen, plineWithContinuation, } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { meltIce } from '../js/ice.js';
import { createCorpstatAt } from '../js/mklev.js';
import { nameToMonster } from '../js/mondata.js';
import { angerMonster, publishMonsterYelp, publishMonsterGrowl, } from '../js/monster_anger.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { wakeMonstersNearWithMessages } from '../js/monster_wake.js';
import { BOULDER, CORPSE, ROCK } from '../js/object_data.js';
import { objectTimers, OBJECT_TIMER_KIND, LEVEL_TIMER_KIND, scheduleLevelTimer, } from '../js/object_timers.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { startRun } from '../js/runmode.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setHeroBlindnessTurns, syncDeafness } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { runDueTimers } from '../js/timer_effects.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { installPagerInput } from './support/pager-input.js';
async function topline() {
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row);
    return row.map(cell => cell.ch).join('').trimEnd();
}
async function dog() {
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    return pet;
}
void test('an unnamed pet yelps with its native definite name and stops running', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await dog();
    startRun(1, 0);
    await publishMonsterYelp(pet);
    assert.equal(await topline(), 'The little dog yelps!');
    assert.equal(game.context.run, 0);
});
void test('a deaf hero sees an invisible named pet recoil, rather than hearing a yelp', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await dog();
    setMonsterGivenName(pet, 'Fido');
    pet.minvis = true;
    grantIntrinsicProperty('seeInvisible', 'outside');
    game.u.deafTurns = 10;
    syncDeafness();
    assert.equal(canSeeMonster(pet), true);
    await publishMonsterYelp(pet);
    assert.equal(await topline(), 'The invisible Fido recoils!');
});
void test("yelp wake distance depends on species, not a pet's gained experience levels", async () => {
    freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    const pet = await dog();
    pet.m_lev = 30;
    const near = await createMonsterAt('goblin', 13, 10);
    const far = await createMonsterAt('goblin', 17, 10);
    near.msleeping = far.msleeping = 1;
    await publishMonsterYelp(pet);
    assert.equal(near.msleeping, 0);
    assert.equal(far.msleeping, 1);
});
void test('a telepathically sensed growl does not interrupt a blind deaf hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await dog();
    grantIntrinsicProperty('telepathy', 'outside');
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    game.u.deafTurns = 10;
    syncDeafness();
    assert.equal(canSpotMonster(pet), true);
    assert.equal(canSeeMonster(pet), false);
    startRun(1, 0);
    await publishMonsterGrowl(pet);
    assert.equal(await topline(), '');
    assert.equal(game.context.run, 1);
    game.u.deafTurns = 0;
    syncDeafness();
    await publishMonsterGrowl(pet);
    assert.equal(await topline(), 'The little dog growls!');
    assert.equal(game.context.run, 0);
});
void test('a silent animal does not produce a hallucinated yelp or stop running', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const blob = await createMonsterAt('acid blob', 11, 10);
    startRun(1, 0);
    await publishMonsterYelp(blob);
    assert.equal(await topline(), '');
    assert.equal(game.context.run, 1);
    const audiblePet = await createMonsterAt('little dog', 12, 10);
    await publishMonsterYelp(audiblePet);
    assert.match(await topline(), /!$/);
    assert.equal(game.context.run, 0);
});
async function buriedZombieAt(x, y) {
    const corpse = await createCorpstatAt(CORPSE, null, nameToMonster('human'), x, y, CORPSTAT_INIT, { zombify: true });
    await buryObject(corpse);
    return corpse;
}
function zombieTimeLeft(corpse) {
    const timer = objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
    assert.ok(timer);
    return timer.deadline - game.moves;
}
void test('noise disturbs buried zombies only near its origin, independently of waking distance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const nearby = await buriedZombieAt(12, 11);
    const distant = await buriedZombieAt(13, 10);
    const nearbyTime = zombieTimeLeft(nearby);
    const distantTime = zombieTimeLeft(distant);
    assert.ok(nearbyTime > 3);
    await wakeMonstersNearWithMessages(11, 10, 1);
    assert.equal(zombieTimeLeft(nearby), Math.trunc(nearbyTime * 2 / 3));
    assert.equal(zombieTimeLeft(distant), distantTime);
    await wakeMonstersNearWithMessages(11, 10, 1);
    assert.equal(zombieTimeLeft(nearby), Math.trunc(Math.trunc(nearbyTime * 2 / 3) * 2 / 3));
});
void test('a visible flesh golem wakes with its name and the native exclamation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const golem = await createMonsterAt('flesh golem', 11, 10);
    setMonsterGivenName(golem, 'Frank');
    golem.msleeping = 1;
    await wakeMonstersNearWithMessages(10, 10, 10);
    assert.equal(golem.msleeping, 0);
    assert.equal(await topline(), "Frank wakes up. It's alive!");
});
void test('a game can save and restore after a growl, then continue ordinary messages', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await dog();
    game.plname = 'PetSounds';
    const storage = memoryStorage();
    await publishMonsterGrowl(pet);
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    requirePlayingGame(game);
    assert.equal(restoreGame('PetSounds', storage), true);
    await plineWithContinuation('The dungeon is quiet.');
    assert.equal(await topline(), 'The dungeon is quiet.');
});
for (const sleeping of [false, true]) {
    void test(`a fleeing bystander ${sleeping ? 'uses its name after a wake message' : 'can follow its growl with a separate sentence'}`, async () => {
        freshObjectRoom({ right: 24 });
        requirePlayingGame(game);
        const victim = await createMonsterAt('little dog', 11, 10);
        const observer = await createMonsterAt('little dog', 16, 10);
        const golem = await createMonsterAt('flesh golem', 20, 10);
        victim.mpeaceful = observer.mpeaceful = 1;
        golem.mpeaceful = 0;
        golem.msleeping = sleeping;
        initRng(17n);
        const input = resetInputState();
        installPagerInput(input, {
            expected: /The little dog growls!|The flesh golem wakes up\. It's alive!/, limit: 2,
        });
        await angerMonster(victim);
        assert.equal(golem.msleeping, 0);
        assert.equal(observer.mflee, 1);
        assert.match(await topline(), sleeping
            ? /The little dog turns to flee\.$/
            : /And then starts to flee\.$/);
    });
}
void test('one digging noise shortens a buried zombie timer once', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await buriedZombieAt(11, 10);
    const before = zombieTimeLeft(corpse);
    assert.ok(before > 3);
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = POOL;
    await digHole({ pitOnly: true });
    assert.equal(zombieTimeLeft(corpse), Math.trunc(before * 2 / 3));
});
void test('sleeping or paralyzed pets do not make distress sounds', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await dog();
    const corpse = await buriedZombieAt(12, 10);
    const before = zombieTimeLeft(corpse);
    startRun(1, 0);
    pet.msleeping = 1;
    await publishMonsterYelp(pet);
    pet.msleeping = 0;
    pet.mcanmove = 0;
    await publishMonsterGrowl(pet);
    assert.equal(await topline(), '');
    assert.equal(zombieTimeLeft(corpse), before);
    assert.equal(game.context.run, 1);
    pet.mcanmove = 1;
    await publishMonsterGrowl(pet);
    assert.equal(await topline(), 'The little dog growls!');
    assert.equal(zombieTimeLeft(corpse), Math.trunc(before * 2 / 3));
    assert.equal(game.context.run, 0);
});
for (const timed of [false, true]) {
    void test(`${timed ? 'timed' : 'direct'} ice melting wakes nearby monsters and disturbs buried zombies once`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const ice = requireGameLevel().requireAt(11, 10);
        ice.typ = ICE;
        ice.icedpool = ICED_POOL;
        await floorObject(BOULDER, 11, 10);
        const goblin = await createMonsterAt('goblin', 13, 10);
        goblin.msleeping = 1;
        const corpse = await buriedZombieAt(12, 10);
        const before = zombieTimeLeft(corpse);
        assert.ok(before > 3);
        const input = resetInputState();
        if (timed) {
            scheduleLevelTimer(11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves);
        }
        await answerPrompts(timed ? runDueTimers() : meltIce(11, 10), input, [
            { prompt: timed ? /Some ice melts away\..*--More--/s
                    : /The ice crackles and melts\..*--More--/s, keys: ' ' },
            { prompt: /There is a large splash as the boulder fills the pool of water\..*--More--/s, keys: ' ' },
        ]);
        assert.equal(goblin.msleeping, 0);
        assert.equal(zombieTimeLeft(corpse), Math.trunc(before * 2 / 3));
    });
}
void test('a thrown stone wakes a sleeping pet after the hit, without an early distress sound', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { uhitinc: 50 } });
    requirePlayingGame(game);
    const pet = await dog();
    setMonsterGivenName(pet, 'Fido');
    pet.msleeping = 1;
    pet.mhp = pet.mhpmax = 40;
    await addInventoryObject(ROCK, { invlet: 'a' });
    initRng(17n);
    const input = resetInputState();
    await answerPrompts(rhack('t'.charCodeAt(0)), input, [
        { prompt: /What do you want to throw\?/, keys: 'a' },
        { prompt: /In what direction\?/, keys: 'l' },
    ]);
    assert.ok(pet.mhp < 40 && pet.mhp > 0);
    assert.equal(pet.msleeping, 0);
    assert.match(await topline(), /The rock hits Fido\.  Fido wakes up!  Fido growls!$/);
});
//# sourceMappingURL=pet_distress.test.js.map