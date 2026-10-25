import test from 'node:test';
import assert from 'node:assert/strict';
import { dosounds } from '../js/ambient_sounds.js';
import { ANY_SHOP, BARRACKS, BEEHIVE, COURT, MON_MIGRATING, MORGUE, ROOMOFFSET, SWAMP, TEMPLE, VAULT, ZOO } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { searchSpecial } from '../js/mkroom.js';
import { GOLD_PIECE, HELMET } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
function soundRoom(type) {
    const level = freshObjectRoom();
    const room = {
        lx: 7, hx: 9, ly: 8, hy: 12, rtype: type, rlit: 1,
        needfill: 0, doorct: 0, fdoor: 0, nsubrooms: 0, sbrooms: [],
        roomnoidx: 0, irregular: false, needjoining: false,
    };
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return level;
}
async function topline() {
    await flush_screen();
    return game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('a staffed temple outside the hero room produces a prayer to its deity', async () => {
    const level = soundRoom(TEMPLE);
    requirePlayingGame(game);
    const priest = await createMonsterAt('aligned cleric', 8, 10);
    priest.ispriest = 1;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    priest.msleeping = 0;
    priest.mcanmove = 1;
    level.flags.has_temple = true;
    initRng(167);
    await dosounds();
    assert.match(await topline(), /You hear someone beseeching .+\./);
});
void test('a flying bee in a beehive produces its ambient buzzing', async () => {
    const level = soundRoom(BEEHIVE);
    await createMonsterAt('killer bee', 8, 10);
    level.flags.has_beehive = true;
    initRng(167);
    await dosounds();
    assert.match(await topline(), /You hear (a low buzzing|an angry drone)\./);
});
void test('hallucination shifts the fountain sound choices', async () => {
    const level = soundRoom(0);
    level.flags.nfountains = 1;
    game.u.hallucinationTurns = 20;
    initRng(262);
    await dosounds();
    assert.equal(await topline(), 'You hear water falling on coins.');
});
void test('deafness suppresses level ambient sounds', async () => {
    const level = soundRoom(0);
    level.flags.nfountains = 1;
    game.deaf = true;
    game.u.deafTurns = 5;
    initRng(262);
    await dosounds();
    assert.equal(await topline(), '');
});
void test('submersion suppresses the fountain ambience', async () => {
    const level = soundRoom(0);
    level.flags.nfountains = 1;
    game.u.uinwater = true;
    initRng(262);
    await dosounds();
    assert.equal(await topline(), '');
});
for (const [type, species, flag, message] of [
    [COURT, 'goblin', 'has_court', /You hear a sceptre pounded in judgment\./],
    [MORGUE, 'human zombie', 'has_morgue', /(You suddenly realize it is unnaturally quiet|The hair on the back of your neck stands up)\./],
    [BARRACKS, 'soldier', 'has_barracks', /You hear loud snoring\./],
    [ZOO, 'jackal', 'has_zoo', /You hear a sound reminiscent of (a seal barking|an elephant stepping on a peanut)\./],
]) {
    void test(`a sleeping ${species} supplies its special room's ambient sound`, async () => {
        const level = soundRoom(type);
        const resident = await createMonsterAt(species, 8, 10);
        resident.msleeping = 1;
        level.flags[flag] = true;
        initRng(167);
        await dosounds();
        assert.match(await topline(), message);
    });
}
void test('a swamp event ends the ambient pass before a later shop flag is cleared', async () => {
    const level = soundRoom(SWAMP);
    level.flags.has_swamp = true;
    level.flags.has_shop = true;
    initRng(167);
    await dosounds();
    assert.match(await topline(), /You (hear mosquitoes|smell marsh gas)!/);
    assert.equal(level.flags.has_shop, true);
});
void test('a mounted horse can supply the zoo sound while sharing the hero square', async () => {
    const level = soundRoom(ZOO);
    requirePlayingGame(game);
    const horse = await createSaddledSteed('horse', { x: 8, y: 10 });
    game.u.usteed = horse;
    game.u.ux = horse.mx;
    game.u.uy = horse.my;
    level.flags.has_zoo = true;
    initRng(167);
    await dosounds();
    assert.match(await topline(), /You hear a sound reminiscent of (a seal barking|an elephant stepping on a peanut)\./);
});
void test('a migrating animal cannot supply the zoo sound from its old coordinates', async () => {
    const level = soundRoom(ZOO);
    const horse = await createMonsterAt('horse', 8, 10);
    horse.mstate = MON_MIGRATING;
    level.flags.has_zoo = true;
    initRng(167);
    await dosounds();
    assert.equal(await topline(), '');
});
void test('shop noise announces a visible sleeper and wakes only monsters within range', async () => {
    freshObjectRoom({ right: 28 });
    requirePlayingGame(game);
    await createStaffedShop({ left: 12, right: 14, keeperX: 13 });
    const golem = await createMonsterAt('flesh golem', 11, 10);
    const invisible = await createMonsterAt('gnome', 14, 11);
    const distant = await createMonsterAt('goblin', 25, 10);
    golem.msleeping = invisible.msleeping = distant.msleeping = 1;
    invisible.minvis = true;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(167);
    await dosounds();
    assert.match(await topline(), /The flesh golem wakes up\. It's alive!$/);
    assert.equal(golem.msleeping, 0);
    assert.equal(invisible.msleeping, 0);
    assert.equal(distant.msleeping, 1);
});
void test('a sink somewhere on the level drips', async () => {
    const level = soundRoom(0);
    level.flags.nsinks = 1;
    initRng(167);
    await dosounds();
    assert.equal(await topline(), 'You hear a slow drip.');
});
void test('a hallucinating hero hears the dishes being washed at a sink', async () => {
    const level = soundRoom(0);
    level.flags.nsinks = 1;
    game.u.hallucinationTurns = 20;
    initRng(743);
    await dosounds();
    assert.equal(await topline(), 'You hear dishes being washed!');
});
void test('gold in an unguarded vault is heard being counted', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    const gold = await knownObject(GOLD_PIECE, { quan: 5 });
    gold.ox = 8;
    gold.oy = 10;
    (level.objects[8] ??= [])[10] = [gold];
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear someone counting gold coins.');
});
void test('a hallucinating hero hears the quarterback calling the play in a gold vault', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    const gold = await knownObject(GOLD_PIECE, { quan: 5 });
    gold.ox = 8;
    gold.oy = 10;
    (level.objects[8] ??= [])[10] = [gold];
    game.u.hallucinationTurns = 20;
    initRng(167);
    await dosounds();
    assert.equal(await topline(), 'You hear the quarterback calling the play.');
});
void test('an empty vault sounds like someone searching', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear someone searching.');
});
void test('a patrolling guard is heard inside the vault quiet', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    initRng(167);
    await dosounds();
    assert.equal(await topline(), 'You hear the footsteps of a guard on patrol.');
});
void test('a hallucinating hero hears Ebenezer Scrooge in the vault', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear Ebenezer Scrooge!');
});
void test('a vault guard on the level silences the vault ambience', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    const guard = await createMonsterAt('guard', 25, 10);
    guard.isgd = 1;
    guard._egd = {
        gdlevel: { dnum: 0, dlevel: 8 }, ogx: guard.mx, ogy: guard.my, witness: 0,
        gddone: 0, gdx: guard.mx, gdy: guard.my, vault: null, warncnt: 0,
        fcbeg: 0, fcend: 0, fakecorr: [], dropgoldcnt: 0,
    };
    initRng(167);
    await dosounds();
    assert.equal(await topline(), '');
});
void test('the hero standing in a vault hears no vault ambience', async () => {
    const level = soundRoom(VAULT);
    level.flags.has_vault = true;
    game.u.urooms = [ROOMOFFSET];
    initRng(167);
    await dosounds();
    assert.equal(await topline(), '');
});
void test('a vanished vault clears its level flag and ends the ambient pass', async () => {
    const level = soundRoom(0);
    level.flags.has_vault = true;
    level.flags.has_shop = true;
    initRng(167);
    await dosounds();
    // C dosounds() returns right after clearing has_vault, leaving has_shop
    // for a later ambient pass to notice.
    assert.equal(level.flags.has_vault, false);
    assert.equal(level.flags.has_shop, true);
    assert.equal(await topline(), '');
});
void test('a vanished shop clears its level flag instead of sounding', async () => {
    const level = soundRoom(0);
    level.flags.has_shop = true;
    initRng(167);
    await dosounds();
    assert.equal(level.flags.has_shop, false);
    assert.equal(await topline(), '');
});
void test('a hallucinating court sounds the headsman', async () => {
    const level = soundRoom(COURT);
    level.flags.has_court = true;
    const courtier = await createMonsterAt('goblin', 8, 10);
    courtier.msleeping = 1;
    game.u.hallucinationTurns = 20;
    initRng(167);
    await dosounds();
    assert.equal(await topline(), 'Someone shouts "Off with his head!"');
});
void test("a hallucinating court hears Queen Beruthiel's cats", async () => {
    const level = soundRoom(COURT);
    level.flags.has_court = true;
    const courtier = await createMonsterAt('goblin', 8, 10);
    courtier.msleeping = 1;
    game.u.hallucinationTurns = 20;
    initRng(1559);
    await dosounds();
    assert.equal(await topline(), "You hear Queen Beruthiel's cats!");
});
void test('a hallucinating hero hears bees in a nonexistent bonnet', async () => {
    const level = soundRoom(BEEHIVE);
    level.flags.has_beehive = true;
    await createMonsterAt('killer bee', 8, 10);
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear bees in your (nonexistent) bonnet!');
});
void test('a helmeted hallucinating hero keeps real bees in the bonnet', async () => {
    const level = soundRoom(BEEHIVE);
    level.flags.has_beehive = true;
    await createMonsterAt('killer bee', 8, 10);
    game.uarmh = game.u.uarmh = await knownObject(HELMET, {});
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear bees in your bonnet!');
});
void test('a hallucinating hero feels the hair on the head rise in a morgue', async () => {
    const level = soundRoom(MORGUE);
    level.flags.has_morgue = true;
    await createMonsterAt('human zombie', 8, 10);
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'The hair on your head seems to stand up.');
});
void test('a hallucinating hero hears General MacArthur in the barracks', async () => {
    const level = soundRoom(BARRACKS);
    level.flags.has_barracks = true;
    const soldier = await createMonsterAt('soldier', 8, 10);
    soldier.msleeping = 1;
    game.u.hallucinationTurns = 20;
    initRng(1559);
    await dosounds();
    assert.equal(await topline(), 'You hear General MacArthur!');
});
void test('a hallucinating hero hears Doctor Dolittle at the zoo', async () => {
    const level = soundRoom(ZOO);
    level.flags.has_zoo = true;
    await createMonsterAt('jackal', 8, 10);
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear Doctor Dolittle!');
});
void test('a hallucinating hero hears Donald Duck in the swamp', async () => {
    const level = soundRoom(SWAMP);
    level.flags.has_swamp = true;
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear Donald Duck!');
});
void test('a hallucinating hero hears Neiman and Marcus arguing in a tended shop', async () => {
    freshObjectRoom({ right: 28 });
    await createStaffedShop({ left: 12, right: 14, keeperX: 13 });
    game.u.urooms = [];
    game.u.hallucinationTurns = 20;
    initRng(897);
    await dosounds();
    assert.equal(await topline(), 'You hear Neiman and Marcus arguing!');
});
void test('an untended shop stays quiet while its level flag remains', async () => {
    const level = freshObjectRoom({ right: 28 });
    await createStaffedShop({ left: 12, right: 14, keeperX: 13 });
    const shopRoom = searchSpecial(ANY_SHOP, game);
    assert.ok(shopRoom, 'the level should still hold the shop room');
    shopRoom.resident = null;
    game.u.urooms = [];
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(167);
    await dosounds();
    assert.equal(await topline(), '');
    assert.equal(level.flags.has_shop, true);
});
void test('an unseen oracle murmurs on her own level', async () => {
    soundRoom(0);
    game.oracle_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: 0 };
    const oracle = await createMonsterAt('Oracle of Delphi', 8, 10);
    oracle.minvis = 1;
    initRng(262);
    await dosounds();
    assert.equal(await topline(), 'You hear a strange wind.');
    game.oracle_level = undefined;
});
void test('a plainly visible oracle has nothing more to say', async () => {
    soundRoom(0);
    game.oracle_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: 0 };
    await createMonsterAt('Oracle of Delphi', 8, 10);
    initRng(262);
    await dosounds();
    assert.equal(await topline(), '');
    game.oracle_level = undefined;
});
//# sourceMappingURL=ambient_sounds.test.js.map