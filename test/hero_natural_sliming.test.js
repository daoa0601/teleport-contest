import { monsterAtPosition } from '../js/monster_location.js';
import { ensureQuestStatus } from '../js/quest.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MFAST, M_ATTK_DEF_DIED, M_ATTK_MISS, MM_NOGRP, NO_MINVENT, NORMAL_SPEED, STRAT_WAITFORU, FIRE_TRAP, W_ARMC } from '../js/const.js';
import { clearMessageWindow } from '../js/display.js';
import { wearEyewear } from '../js/eyewear.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroNaturalSliming } from '../js/hero_natural_sliming.js';
import { resetInputState } from '../js/input.js';
import { AD_SLIM } from '../js/monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { tryMonsterUnslime } from '../js/monster_unslime.js';
import { CLOAK_OF_PROTECTION, FIRE_HORN, POT_OIL, SCR_FIRE, WAN_FIRE } from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc } from '../js/vision.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
function forceSliming(range) {
    if (range === 4)
        return 0;
    if (range === 5)
        return 1;
    return range - 1;
}
async function slimeAttack(species = 'orc', { visible = true } = {}) {
    freshObjectRoom({ role: 'monk', gameplaySeed: 83n });
    requirePlayingGame(game);
    if (visible) {
        ensureQuestStatus().touched_artifact = true;
        const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
        assert.equal(await wearEyewear(eyes), true);
    }
    installPolymorphedHero('green slime');
    vision_recalc(0);
    clearMessageWindow();
    const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    monster.movement = 24;
    const attack = MONSTER_ATTACKS[game.u.umonnum]?.find(([, type]) => type === AD_SLIM);
    assert.ok(attack, 'The hero green slime must have its natural sliming attack');
    const messages = [];
    const context = {
        state: game, publish: async (message) => { messages.push(message); },
        random: forceSliming, rollDice: (dice, sides) => dice * sides, rollOne: sides => sides,
        damage: 6, specialDamage: 0, target: { x: 11, y: 10 }, attack,
    };
    return { monster, context, messages };
}
void test('natural sliming changes an uncured target into green slime and removes contact damage', async () => {
    const { monster, context, messages } = await slimeAttack();
    monster.mstrategy = STRAT_WAITFORU;
    const result = await applyHeroNaturalSliming(monster, context);
    assert.equal(monster.mnum, PM_GREEN_SLIME);
    assert.equal(monster.mstrategy & STRAT_WAITFORU, 0);
    assert.equal(result.damage, 0);
    assert.equal(result.done, false);
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.ok(messages.includes('You turn the orc into slime.'));
});
for (const reason of ['magic negation', 'failed chance']) {
    void test(`${reason} leaves only the physical damage of the slime attack`, async () => {
        const { monster, context } = await slimeAttack();
        if (reason === 'magic negation') {
            await equipMonsterObject(monster, await knownObject(CLOAK_OF_PROTECTION), W_ARMC);
            context.random = () => 0;
        }
        else
            context.random = range => range - 1;
        const result = await applyHeroNaturalSliming(monster, context);
        assert.equal(monster.mnum, MONSTER_NAME.indexOf('orc'));
        assert.equal(result.damage, 6);
        assert.equal(monster.mhp, 100);
    });
}
for (const species of ['green slime', 'fire elemental', 'ghost']) {
    void test(`${species} cannot be slimed`, async () => {
        const { monster, context } = await slimeAttack(species);
        const result = await applyHeroNaturalSliming(monster, context);
        assert.equal(monster.mnum, MONSTER_NAME.indexOf(species));
        assert.equal(result.damage, 6);
        assert.equal(monster.movement, 24);
    });
}
void test('fire breath takes priority over a wand and spends the defender next move', async () => {
    const { monster, context, messages } = await slimeAttack('red dragon');
    const wand = await knownObject(WAN_FIRE, { spe: 3 });
    await addObjectToMonsterInventory(monster, wand);
    monster.permspeed = monster.mspeed = MFAST;
    context.random = range => range === 3 ? 0 : forceSliming(range);
    const result = await applyHeroNaturalSliming(monster, context);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('red dragon'));
    assert.equal(monster.mhp, 100);
    assert.equal(wand.spe, 3);
    assert.equal(monster.mspec_used, 14);
    assert.equal(monster.permspeed, 0);
    assert.equal(monster.movement, 24 - NORMAL_SPEED);
    assert.equal(monster.mlstmv, context.state.moves);
    assert.equal(result.damage, 0);
    // Pinned muse_unslime supplies "breath" to vtense(), which adds "s".
    assert.ok(messages.includes('The red dragon breaths fire on itself.'));
});
for (const itemType of [WAN_FIRE, FIRE_HORN]) {
    void test(`${itemType === WAN_FIRE ? 'a wand' : 'a horn'} burns away slime with one charge and actual self damage`, async () => {
        const { monster, context, messages } = await slimeAttack();
        const item = await knownObject(itemType, { spe: 3 });
        await addObjectToMonsterInventory(monster, item);
        const result = await applyHeroNaturalSliming(monster, context);
        assert.equal(monster.mnum, MONSTER_NAME.indexOf('orc'));
        assert.equal(monster.mhp, 88);
        assert.equal(item.spe, 2);
        assert.equal(result.damage, 0);
        assert.equal(monster.movement, 12);
        assert.ok(context.state._knownObjectTypes?.has(itemType));
        assert.ok(messages.some(message => message.endsWith('slime is burned away!')));
    });
}
void test('a cancelled dragon whose breath is unavailable uses its wand instead', async () => {
    const { monster, context } = await slimeAttack('red dragon');
    monster.mcan = 1;
    const wand = await knownObject(WAN_FIRE, { spe: 2 });
    await addObjectToMonsterInventory(monster, wand);
    await applyHeroNaturalSliming(monster, context);
    assert.equal(wand.spe, 1);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('red dragon'));
    assert.equal(monster.mhp, 100);
});
void test('a sleeping defender cannot use its carried cure and becomes slime', async () => {
    const { monster, context } = await slimeAttack();
    monster.msleeping = 1;
    monster.mlstmv = context.state.moves - 1;
    const lastMove = monster.mlstmv;
    const wand = await knownObject(WAN_FIRE, { spe: 2 });
    await addObjectToMonsterInventory(monster, wand);
    await applyHeroNaturalSliming(monster, context);
    assert.equal(monster.mnum, PM_GREEN_SLIME);
    assert.equal(wand.spe, 2);
    assert.equal(monster.movement, 16, 'the slower slime body rescales the saved movement from 24 to 16');
    assert.equal(monster.mlstmv, lastMove, 'a sleeping monster did not spend a turn on a cure');
});
void test('a fatal self-zap credits the hero without breaking pacifist conduct', async () => {
    const { monster, context, messages } = await slimeAttack();
    monster.mhp = 1;
    const wand = await knownObject(WAN_FIRE, { spe: 2 });
    await addObjectToMonsterInventory(monster, wand);
    const experience = context.state.u.uexp;
    const kills = context.state.u.uconduct.killer ?? 0;
    const result = await applyHeroNaturalSliming(monster, context);
    assert.equal(result.done, true);
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(context.state.level, monster.mx, monster.my), monster);
    assert.ok(context.state.u.uexp > experience);
    assert.equal(context.state.u.uconduct.killer ?? 0, kills);
    assert.ok(messages.includes('The orc is killed by the fire!'));
});
void test('a confused fire scroll is consumed after its naming prompt and fails to stop sliming', async () => {
    const { monster, context, messages } = await slimeAttack();
    monster.mconf = 1;
    const scroll = await knownObject(SCR_FIRE, { known: false, dknown: false, typeKnown: false, bknown: false });
    await addObjectToMonsterInventory(monster, scroll);
    const input = resetInputState();
    const result = await answerPrompts(applyHeroNaturalSliming(monster, context), input, [
        { prompt: /Call a scroll labeled .*:/, keys: ['s', 'p', 'a', 'r', 'k', 's', 10] },
    ]);
    assert.equal(scroll.where, 'gone');
    assert.equal(monster.mnum, PM_GREEN_SLIME);
    assert.equal(monster.movement, 8, 'the cure spends 12 movement, then the slower slime body rescales the remaining 12 to 8');
    assert.equal(monster.mlstmv, context.state.moves);
    assert.equal(result.damage, 0);
    assert.equal(context.state._objectCallNames?.[SCR_FIRE], 'sparks');
    assert.ok(messages.includes('Oh, what a pretty fire!'));
});
void test('a successful fire scroll burns the user and nearby monsters before curing it', async () => {
    const { monster, context } = await slimeAttack();
    const bystander = await createMonsterAt('newt', 12, 10, MM_NOGRP | NO_MINVENT);
    bystander.mhp = 100;
    const scroll = await knownObject(SCR_FIRE);
    await addObjectToMonsterInventory(monster, scroll);
    await applyHeroNaturalSliming(monster, context);
    assert.equal(scroll.where, 'gone');
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('orc'));
    assert.ok(monster.mhp < 100);
    assert.ok(bystander.mhp < 100);
    assert.equal(monster.movement, 12);
});
void test('oil uses one potion from its stack and removes the consumed burn timer', async () => {
    const { monster, context, messages } = await slimeAttack();
    const oil = await knownObject(POT_OIL, { quan: 2, age: 400 });
    await addObjectToMonsterInventory(monster, oil);
    await applyHeroNaturalSliming(monster, context);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('orc'));
    assert.equal(monster.mhp, 100, 'pinned muse_unslime does not subtract its oil damage draw');
    assert.equal(oil.quan, 1);
    assert.equal(oil.lamplit ?? false, false);
    assert.equal(monster.minvent.length, 1);
    assert.equal(objectTimers(oil).length, 0);
    assert.ok(messages.some(message => message.includes('quaffs a burning')));
    assert.equal(monster.movement, 12);
});
void test('an unseen self-zap forgets the wand knowledge while its sound remains audible', async () => {
    const { monster, context, messages } = await slimeAttack('orc', { visible: false });
    const wand = await knownObject(WAN_FIRE, { spe: 2 });
    await addObjectToMonsterInventory(monster, wand);
    wand.known = wand.dknown = wand.bknown = true;
    await applyHeroNaturalSliming(monster, context);
    assert.equal(wand.known, false);
    assert.equal(wand.dknown, false);
    assert.equal(wand.bknown, false);
    assert.equal(wand.spe, 1);
    assert.ok(messages.includes('You hear a nearby zap.'));
});
void test('an uncured intelligent monster moves onto a nearby fire trap and spends its next move', async () => {
    const { monster, context, messages } = await slimeAttack();
    const trap = addTrap(context.state.level, FIRE_TRAP, 12, 10);
    initRng(5n);
    const result = await applyHeroNaturalSliming(monster, context);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('orc'));
    assert.equal(monster.mx, 12);
    assert.equal(monster.my, 10);
    assert.equal(monster.mhp, 92);
    assert.equal(monster.movement, 12);
    assert.equal(trap.tseen, true);
    assert.equal(result.damage, 0);
    assert.ok(messages.some(message => message.includes('moves onto a fire trap!')));
});
void test('a fire-trap cure fatality is not credited to the hero who applied slime', async () => {
    const { monster, context } = await slimeAttack();
    monster.mhp = 1;
    addTrap(context.state.level, FIRE_TRAP, 11, 10);
    const experience = context.state.u.uexp;
    const kills = context.state.u.uconduct.killer ?? 0;
    const result = await applyHeroNaturalSliming(monster, context);
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(result.done, true);
    assert.equal(context.state.u.uexp, experience);
    assert.equal(context.state.u.uconduct.killer ?? 0, kills);
});
void test('animals do not cure slime with a carried wand or nearby trap', async () => {
    const { monster, context } = await slimeAttack('pony');
    const wand = await knownObject(WAN_FIRE, { spe: 2 });
    await addObjectToMonsterInventory(monster, wand);
    addTrap(context.state.level, FIRE_TRAP, 12, 10);
    const result = await tryMonsterUnslime(monster, { ...context, byHero: true });
    assert.equal(result.cured, false);
    assert.equal(monster.mx, 11);
    assert.equal(monster.movement, 24);
    assert.equal(wand.spe, 2);
});
//# sourceMappingURL=hero_natural_sliming.test.js.map