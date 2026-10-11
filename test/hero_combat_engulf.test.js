import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { DOOR, D_CLOSED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, NO_MINVENT, W_AMUL } from '../js/const.js';
import { flushPendingTopline, flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resolveHeroCombatEngulf } from '../js/hero_combat_engulf.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { AD_ACID, AD_BLND, AD_COLD, AD_DGST, AD_DREN, AD_ELEC, AD_FIRE, AD_PHYS, AT_ENGL, } from '../js/monster_attack_types.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, OIL_LAMP } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectQuantityAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
const engulf = (type) => [AT_ENGL, type, 1, 6];
void test('digestion consumes life saving, grants nutrition, and leaves the victim inventory but no corpse', async () => {
    const { level, publish } = room('purple worm');
    requirePlayingGame(game);
    const victim = await createMonsterAt('kobold', 11, 10, NO_MINVENT);
    const amulet = await equipMonsterObject(victim, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const lamp = await knownObject(OIL_LAMP);
    await addObjectToMonsterInventory(victim, lamp);
    const hunger = game.u.uhunger;
    const result = await resolveHeroCombatEngulf(victim, engulf(AD_DGST), { publish, random: () => 0 });
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.includes(victim), false);
    assert.equal(amulet.where, 'gone');
    assert.equal(lamp.where, 'floor');
    assert.equal(floorObjectQuantityAt(level, 11, 10, CORPSE), 0);
    assert.ok(game.u.uhunger > hunger);
    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(requireMonsterVital(victim.mnum).died, 1);
    assert.ok((game._helplessTurns ?? 0) > 0);
    assert.equal(game._monsterSwallower, null);
});
void test('a swallowed floating eye grants telepathy only when digestion finishes, including after save and restore', async () => {
    const { input, publish } = room('purple worm');
    requirePlayingGame(game);
    const eye = await createMonsterAt('floating eye', 11, 10, NO_MINVENT);
    const storage = memoryStorage();
    await resolveHeroCombatEngulf(eye, engulf(AD_DGST), { publish, random: () => 0 });
    assert.ok(!game.u.telepathy);
    assert.equal(game._helplessTurns, 1);
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    requirePlayingGame(game);
    await flushPendingTopline();
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.context.move = 0;
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /You feel a strange mental acuity\./);
    assert.equal(game.u.telepathy, true);
    assert.equal(game._digestedMonsterSpecies, null);
    assert.equal(game._helplessAfter, null);
});
void test('slow digestion expels a living victim without food conduct or nutrition', async () => {
    const { publish, messages } = room('purple worm');
    requirePlayingGame(game);
    game.u.slowDigestion = true;
    const victim = await createMonsterAt('kobold', 11, 10, NO_MINVENT);
    const hp = victim.mhp;
    const hunger = game.u.uhunger;
    const result = await resolveHeroCombatEngulf(victim, engulf(AD_DGST), { publish });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(victim.mhp, hp);
    assert.equal(game.u.uhunger, hunger);
    assert.ok(!game.u.uconduct.food);
    assert.match(messages.join('\n'), /regurgitate the kobold/);
    assert.match(messages.join('\n'), /didn't like the kobold's taste/);
});
for (const obstruction of ['large target', 'trapped target', 'closed doorway', 'full stomach']) {
    void test(`engulf admission refuses a ${obstruction}`, async () => {
        const { level, publish, messages } = room('purple worm');
        requirePlayingGame(game);
        const victim = await createMonsterAt(obstruction === 'large target' ? 'giant' : 'kobold', 11, 10, NO_MINVENT);
        if (obstruction === 'trapped target')
            victim.mtrapped = 1;
        if (obstruction === 'closed doorway') {
            const square = level.requireAt(11, 10);
            square.typ = DOOR;
            square.doormask = D_CLOSED;
        }
        if (obstruction === 'full stomach')
            game.u.uhunger = 1500;
        const hp = victim.mhp;
        const result = await resolveHeroCombatEngulf(victim, engulf(AD_DGST), { publish });
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(victim.mhp, hp);
        assert.equal(messages.length, 0);
        assert.ok(!game.u.uconduct.food);
    });
}
void test('a named vampire returns to its own form and is expelled before digestion', async () => {
    const { level, publish, messages } = room('purple worm');
    requirePlayingGame(game);
    const vampire = await createMonsterAt('vampire bat', 11, 10, NO_MINVENT);
    vampire.cham = MONSTER_NAME.indexOf('vampire');
    vampire.name = 'Dracula';
    const result = await resolveHeroCombatEngulf(vampire, engulf(AD_DGST), { publish });
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(vampire.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(vampire.name, 'Dracula');
    assert.equal(level.monsters.includes(vampire), true);
    assert.ok(!game.u.uconduct.food);
    assert.match(messages.join('\n'), /It turns into a vampire\./);
});
for (const lifeSaved of [false, true]) {
    void test(`digesting a Rider ${lifeSaved ? 'can life-save the hero but leaves the Rider alive' : 'kills the hero without killing the Rider'}`, async () => {
        const { level, publish } = room('purple worm');
        requirePlayingGame(game);
        const rider = await createMonsterAt('Death', 11, 10, NO_MINVENT);
        const amulet = lifeSaved ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet)
            await wearHeroAccessory(amulet, 'uamul');
        const result = await resolveHeroCombatEngulf(rider, engulf(AD_DGST), { publish });
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(result.heroDied, !lifeSaved);
        assert.equal(!!game.program_state.gameover, !lifeSaved);
        assert.equal(level.monsters.includes(rider), true);
        assert.ok(rider.mhp > 0);
        assert.equal(game.u.uconduct.food, 1);
        if (amulet)
            assert.equal(amulet.where, 'gone');
        else
            assert.equal(game._deathKiller, 'unwisely tried to eat Death');
    });
}
void test('engulf contact with a cockatrice petrifies even with slow digestion', async () => {
    const { level, publish } = room('purple worm');
    requirePlayingGame(game);
    game.u.slowDigestion = true;
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const result = await resolveHeroCombatEngulf(cockatrice, engulf(AD_DGST), { publish });
    assert.equal(result.heroDied, false);
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.u.umortality, 1);
    assert.equal(level.monsters.includes(cockatrice), true);
    assert.equal(game.u.uconduct.food, 1);
});
void test('a gas spore explodes inside the digesting hero without striking nearby monsters', async () => {
    const { publish } = room('purple worm');
    requirePlayingGame(game);
    const spore = await createMonsterAt('gas spore', 11, 10, NO_MINVENT);
    const bystander = await createMonsterAt('kobold', 12, 10, NO_MINVENT);
    bystander.mhp = 1;
    const hp = game.u.mh;
    const result = await resolveHeroCombatEngulf(spore, engulf(AD_DGST), { publish, rollDice: (count, sides) => count * sides });
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(result.heroDied, false);
    assert.ok(game.u.mh < hp);
    assert.equal(bystander.mhp, 1);
    assert.ok(!bystander.dead);
    assert.ok(!game._helplessTurns);
    assert.equal(game._monsterSwallower, null);
});
void test('digesting green slime starts sliming without nutrition or a digestion delay', async () => {
    const { publish, messages } = room('purple worm');
    requirePlayingGame(game);
    const slime = await createMonsterAt('green slime', 11, 10, NO_MINVENT);
    const hunger = game.u.uhunger;
    await resolveHeroCombatEngulf(slime, engulf(AD_DGST), { publish, random: () => 0 });
    assert.equal(game.u.slimedTurns, 5);
    assert.equal(game.u.uhunger, hunger);
    assert.ok(!game._helplessTurns);
    assert.match(messages.join('\n'), /You totally digest the green slime\./);
});
void test('fog cannot smother a breathless target but extinguishes its carried lamp', async () => {
    const { publish, messages } = room('fog cloud');
    requirePlayingGame(game);
    const golem = await createMonsterAt('flesh golem', 11, 10, NO_MINVENT);
    const lamp = await knownObject(OIL_LAMP, { age: 200 });
    await addObjectToMonsterInventory(golem, lamp);
    assert.equal(beginObjectBurn(lamp), true);
    const hp = golem.mhp;
    const result = await resolveHeroCombatEngulf(golem, engulf(AD_PHYS), { publish });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(golem.mhp, hp);
    assert.equal(lamp.lamplit, false);
    assert.match(messages.join('\n'), /seems unharmed/);
});
void test('a fog attack hurts a breathing victim and restores both actors on the map after expulsion', async () => {
    const { publish } = room('fog cloud');
    requirePlayingGame(game);
    const victim = await createMonsterAt('kobold', 11, 10, NO_MINVENT);
    victim.mhp = victim.mhpmax = 30;
    const result = await resolveHeroCombatEngulf(victim, engulf(AD_PHYS), { publish, rollDice: () => 6 });
    await flush_screen(1);
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(victim.mhp, 24);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(victim.mx, 11);
    assert.equal(victim.my, 10);
    assert.equal(requireScreenRow(11)[9]?.ch, 'v');
    assert.equal(requireScreenRow(11)[10]?.ch, 'k');
});
void test('a flaming engulfer leaves the victim lamp burning', async () => {
    const { publish } = room('fire vortex');
    const victim = await createMonsterAt('kobold', 11, 10, NO_MINVENT);
    const lamp = await knownObject(OIL_LAMP, { age: 200 });
    await addObjectToMonsterInventory(victim, lamp);
    assert.equal(beginObjectBurn(lamp), true);
    await resolveHeroCombatEngulf(victim, engulf(AD_FIRE), { publish, random: () => 0 });
    assert.equal(lamp.lamplit, true);
    assert.equal(lamp.where, 'minvent');
});
void test('a victim life-saved from physical engulf damage is expelled alive', async () => {
    const { level, publish, messages } = room('fog cloud');
    const victim = await createMonsterAt('kobold', 11, 10, NO_MINVENT);
    victim.mhp = 1;
    const amulet = await equipMonsterObject(victim, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const result = await resolveHeroCombatEngulf(victim, engulf(AD_PHYS), { publish, rollDice: () => 6 });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(amulet.where, 'gone');
    assert.ok(victim.mhp > 0);
    assert.equal(level.monsters.includes(victim), true);
    assert.match(messages.join('\n'), /You expel the kobold!/);
});
for (const [type, form, target] of [
    [AD_FIRE, 'fire vortex', 'red mold'],
    [AD_COLD, 'ice vortex', 'winter wolf'],
    [AD_ELEC, 'energy vortex', 'flesh golem'],
    [AD_ACID, 'ochre jelly', 'acid blob'],
]) {
    void test(`engulf ${type} respects the resistance of a ${target}`, async () => {
        const { publish } = room(form);
        requirePlayingGame(game);
        const victim = await createMonsterAt(target, 11, 10, NO_MINVENT);
        const hp = victim.mhp;
        const result = await resolveHeroCombatEngulf(victim, engulf(type), {
            publish, random: limit => limit - 1, rollDice: (count, sides) => count * sides,
        });
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(victim.mhp, hp);
    });
}
void test('engulf blindness extends temporary blindness to its limit without hurting the victim', async () => {
    const { publish } = room('dust vortex');
    requirePlayingGame(game);
    const victim = await createMonsterAt('kobold', 11, 10, NO_MINVENT);
    victim.mcansee = 0;
    victim.mblinded = 125;
    const hp = victim.mhp;
    await resolveHeroCombatEngulf(victim, engulf(AD_BLND), { publish, rollDice: () => 6 });
    assert.equal(victim.mblinded, 127);
    assert.equal(victim.mcansee, 0);
    assert.equal(victim.mhp, hp);
});
void test('energy engulf delays a caster without reducing HP and stops draining above the native limit', async () => {
    const { publish } = room('energy vortex');
    requirePlayingGame(game);
    const caster = await createMonsterAt('kobold shaman', 11, 10, NO_MINVENT);
    caster.mspec_used = 19;
    const hp = caster.mhp;
    await resolveHeroCombatEngulf(caster, engulf(AD_DREN), { publish, random: () => 0, rollDice: (count, sides) => count * sides });
    assert.equal(caster.mspec_used, 23);
    await resolveHeroCombatEngulf(caster, engulf(AD_DREN), { publish, random: () => 0, rollDice: (count, sides) => count * sides });
    assert.equal(caster.mspec_used, 23);
    assert.equal(caster.mhp, hp);
});
function room(form) {
    const level = freshObjectRoom({
        gameplaySeed: 17n,
        flags: { verbose: true, disclose: '-i -a -v -c -o' },
    });
    installPolymorphedHero(form, { hitPoints: 100 });
    game.storage = memoryStorage();
    const input = resetInputState();
    installPagerInput(input, {
        expected: /swallow|engulf|englut|enclose|regurgitate|expel|release|digest|kill|destroy|experience level|turns into|laden|unharmed|harmless|goo|pummeled|squashed|chilly|hot|unhurt|electricity|lethargic|goes out|turn to stone|You die|But wait|medallion|feel much better|looks much better|amulet of life saving|REST|PEACE|points|mental acuity|There is an explosion in your stomach!/,
        limit: 30,
    });
    const messages = [];
    const publish = async (message) => {
        messages.push(message);
        await plineWithContinuation(message);
    };
    return { level, input, messages, publish };
}
//# sourceMappingURL=hero_combat_engulf.test.js.map