import { advanceHeroPetrification } from './support/condition-turn.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { currentAttribute } from '../js/attrib.js';
import { A_DEX, DOOR, D_CLOSED, D_ISOPEN, NO_MINVENT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshTurnRoom } from './support/playable-room.js';
import { game } from '../js/gstate.js';
import { healHeroLegs, woundHeroLegs } from '../js/hero_legs.js';
import { FOOD_RATION, HEAVY_IRON_BALL } from '../js/object_data.js';
import { startHeroPetrification } from '../js/stoning.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
void test('wounding both legs lowers temporary Dexterity once and reduces carrying capacity', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await addInventoryObject(HEAVY_IRON_BALL);
    const dexterity = currentAttribute(A_DEX);
    const baseDexterity = game.u.acurr.a[A_DEX];
    const messages = [];
    const publish = async (message) => messages.push(message);
    assert.equal(nearCapacity(game), 0);
    await woundHeroLegs('left', 10, game, { publish });
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    assert.equal(nearCapacity(game), 0);
    await woundHeroLegs('right', 20, game, { publish });
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    assert.equal(game.u.acurr.a[A_DEX], baseDexterity);
    assert.equal(nearCapacity(game), 1);
    assert.ok(messages.includes('Your movements are slowed slightly because of your load.'));
    await healHeroLegs(game, { publish });
    assert.equal(currentAttribute(A_DEX), dexterity);
    assert.equal(nearCapacity(game), 0);
    assert.ok(messages.includes('Your legs feel better.'));
    assert.ok(messages.includes('Your movements are now unencumbered.'));
});
void test('leg recovery names the current monster body', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('little dog');
    await woundHeroLegs('left', 10);
    const messages = [];
    await healHeroLegs(game, { publish: async (message) => messages.push(message) });
    assert.ok(messages.includes('Your rear leg feels better.'));
});
void test('a mounted leg recovery heals the steed without claiming the hero feels it', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requireFixtureGame(game);
    const steed = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, steed);
    const dexterity = currentAttribute(A_DEX);
    await woundHeroLegs('both', 10);
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    const messages = [];
    await healHeroLegs(game, { publish: async (message) => messages.push(message) });
    assert.equal(currentAttribute(A_DEX), dexterity);
    assert.ok(!game.u._woundedLegSide);
    assert.ok(!messages.some(message => message.includes('feel')));
});
for (const command of ['o', 'l']) {
    void test(`a leg wound reduces the chance to open a door with ${command}`, async () => {
        for (const wounded of [false, true]) {
            const level = freshObjectRoom();
            const door = level.requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_CLOSED;
            if (wounded)
                await woundHeroLegs('left', 10);
            pushKeys((command === 'o' ? 'l' : '') + ' '.repeat(30));
            initRng(3n);
            await rhack(command.charCodeAt(0));
            assert.equal(door.doormask, wounded ? D_CLOSED : D_ISOPEN);
        }
    });
}
void test('a xan wounds temporary Dexterity through the live actor turn', async () => {
    freshTurnRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const dexterity = currentAttribute(A_DEX);
    const xan = await createMonsterAt('xan', 11, 10, NO_MINVENT);
    xan.mpeaceful = false;
    xan.movement = 12;
    pushKeys('m.' + ' '.repeat(100));
    initRng(1n);
    await moveloop_core();
    await moveloop_core();
    assert.ok(game.u.uhp < 100, 'the xan attack landed');
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    assert.equal(game.u.acurr.a[A_DEX], dexterity);
    await healHeroLegs();
    assert.equal(currentAttribute(A_DEX), dexterity);
});
void test('timed leg recovery interrupts a meal after the recovery message', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const topLines = [];
    input.beforeRead = () => { topLines.push(game._screen_output.split('\n')[0] ?? ''); };
    const ration = await addInventoryObject(FOOD_RATION);
    assert.ok(ration.invlet);
    pushKeys(ration.invlet);
    await rhack('e'.charCodeAt(0));
    assert.equal(game._occupation?.key, 'eat-food');
    await woundHeroLegs('left', 1);
    pushKeys('.' + ' '.repeat(60));
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u._woundedLegTurns, 0, 'the wound timeout elapsed');
    assert.ok(!game._occupation, 'leg recovery stopped the meal');
    const messages = topLines.join(' ');
    assert.ok(messages.includes('Your leg feels better.'));
    assert.ok(messages.indexOf('Your leg feels better.')
        < messages.indexOf('You stop eating the food ration.'));
});
void test("the hero turning to stone does not heal a mounted steed's legs", async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requireFixtureGame(game);
    const steed = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, steed);
    const dexterity = currentAttribute(A_DEX);
    await woundHeroLegs('both', 10);
    startHeroPetrification({ turns: 3, killer: 'cockatrice egg' });
    const messages = [];
    await advanceHeroPetrification({ publish: async (message) => messages.push(message) });
    assert.equal(game.u._woundedLegSide, 'both');
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    assert.ok(messages.includes('Your limbs have turned to stone.'));
});
void test('a xan names a polymorphed hero\'s leg by that form\'s body', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    installPolymorphedHero('stalker', { hitPoints: 100 });
    const xan = await createMonsterAt('xan', 11, 10, NO_MINVENT);
    xan.mpeaceful = false;
    xan.movement = 12;
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    pushKeys('m.' + ' '.repeat(100));
    initRng(1n);
    await moveloop_core();
    await moveloop_core();
    // mhitm_ad_legs() takes body_part(LEG) from the hero's current form.
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /The xan pricks your (?:left|right) lower current!/);
});
//# sourceMappingURL=hero_legs.test.js.map