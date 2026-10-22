import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_TRADITIONAL, STONING } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { useHeroHide } from '../js/hero_hide.js';
import { resetInputState } from '../js/input.js';
import { autopickupAtHero, pickupAtHero } from '../js/pickup.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, DAGGER, GOLD_PIECE, OBJECT_NAMES, ROCK } from '../js/object_data.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
void test('a trapper can hide on the floor', async () => {
    freshRoomWithPolymorphedHero('trapper');
    requireFixtureGame(game);
    await runMonsterAbilityCommand();
    assert.equal(game.u.uundetected, 1);
    assert.equal(game.context.move, 1);
});
void test('a snake needs an object to hide underneath', async () => {
    freshRoomWithPolymorphedHero('garter snake');
    requireFixtureGame(game);
    await runMonsterAbilityCommand();
    assert.equal(game.u.uundetected, 0);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /nothing to hide under/);
    await floorObject(ROCK, game.u.ux, game.u.uy);
    await runMonsterAbilityCommand();
    assert.equal(game.u.uundetected, 1);
    assert.equal(game.context.move, 1);
});
void test('a hiding mimic is drawn as an object', async () => {
    freshRoomWithPolymorphedHero('small mimic');
    requireFixtureGame(game);
    await runMonsterAbilityCommand();
    await flush_screen(1);
    const cell = requireGameDisplay(game).grid[game.u.uy + 1]?.[game.u.ux - 1];
    assert.ok(cell != null);
    assert.equal(cell.ch, ']');
    assert.equal(game.context.move, 1);
});
void test('hiding under petrifying corpses is fatal', async () => {
    freshRoomWithPolymorphedHero('garter snake');
    requireFixtureGame(game);
    await floorObject(CORPSE, game.u.ux, game.u.uy, {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    });
    const deaths = [];
    const result = await useHeroHide({
        state: game,
        publish: async () => undefined,
        refresh: () => undefined,
        die: async (details) => {
            deaths.push(details);
            return true;
        },
    });
    assert.equal(result.spentTime, true);
    const death = deaths[0];
    assert.ok(death);
    assert.equal(death.deathType, STONING);
    assert.ok(death != null);
    assert.match(death.killer, /hiding under a cockatrice corpse/);
});
for (const [typeName, dknown, description] of [
    ['iron shoes', true, 'a pair of iron shoes'],
    ['iron shoes', false, 'a pair of hard shoes'],
    ['gray dragon scales', false, 'a set of gray dragon scales'],
    ['shield of reflection', false, 'a smooth shield'],
]) {
    void test(`hiding describes ${dknown ? 'observed' : 'unobserved'} ${typeName} without call or individual names`, async () => {
        freshRoomWithPolymorphedHero('garter snake');
        requireFixtureGame(game);
        const type = OBJECT_NAMES.indexOf(typeName);
        const cover = await floorObject(type, game.u.ux, game.u.uy, {
            dknown, oname: 'Cover',
        });
        assert.ok(game._objectCallNames);
        game._objectCallNames[type] = 'Special';
        await runMonsterAbilityCommand();
        assert.equal(game.u.uundetected, 1);
        assert.match(game._pending_message, new RegExp(`hiding underneath ${description}\\.`));
        assert.doesNotMatch(game._pending_message, /Special|Cover/);
        assert.equal(cover.dknown, dknown, 'hiding prose does not discover the cover');
    });
}
void test('hiding under a stack uses its plural name without a count', async () => {
    freshRoomWithPolymorphedHero('garter snake');
    requireFixtureGame(game);
    await floorObject(ROCK, game.u.ux, game.u.uy, { quan: 3 });
    await runMonsterAbilityCommand();
    assert.ok(game._pending_message.includes('hiding underneath rocks.'));
    assert.equal(game.u.uundetected, 1);
});
void test('a scorpion that picks up its only cover is no longer hidden', async () => {
    freshRoomWithPolymorphedHero('scorpion');
    requireFixtureGame(game);
    await floorObject(DAGGER, game.u.ux, game.u.uy);
    await runMonsterAbilityCommand();
    assert.equal(game.u.uundetected, 1);
    await pickupAtHero();
    assert.equal(game.u.uundetected, 0);
});
void test('a scorpion autopicking up gold stays hidden under the remaining rock', async () => {
    freshRoomWithPolymorphedHero('scorpion');
    requireFixtureGame(game);
    game.flags.pickup = true;
    game.flags.pickup_types = '$';
    await floorObject(ROCK, game.u.ux, game.u.uy);
    const gold = await floorObject(GOLD_PIECE, game.u.ux, game.u.uy, { quan: 12 });
    await runMonsterAbilityCommand();
    assert.equal(game.u.uundetected, 1);
    const input = resetInputState();
    await answerPrompts(autopickupAtHero(), input, [{ prompt: /\$ - 12 gold pieces\.--More--/, keys: ' ' }]);
    assert.equal(gold.where, 'inventory');
    assert.equal(game.u.uundetected, 1);
});
void test('a scorpion that cancels a traditional pickup stays exposed on the pile', async () => {
    freshRoomWithPolymorphedHero('scorpion');
    requireFixtureGame(game);
    game.flags.menu_style = MENU_TRADITIONAL;
    await floorObject(ROCK, game.u.ux, game.u.uy);
    await floorObject(DAGGER, game.u.ux, game.u.uy);
    assert.ok(!game.u.uundetected);
    const input = resetInputState();
    await answerPrompts(pickupAtHero(), input, [
        { prompt: /There are several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing do you want to pick up\?/, keys: '\x1b' },
    ]);
    assert.ok(!game.u.uundetected);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=hero_hide.test.js.map