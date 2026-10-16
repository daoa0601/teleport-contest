import type { ObjectRoomOptions } from './support/object-room.js';
import type { KnownObjectOverrides } from './support/game-objects.js';
import { requirePlayingGame } from '../js/gstate.js';
import test, { type TestContext } from 'node:test';
import { planInput } from './support/planned-input.js';
import type { PromptAnswer } from './support/input-boundaries.js';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { CORR, D_CLOSED, DOOR, PIT, P_DAGGER, STONE, W_ARMH } from '../js/const.js';
import { game } from '../js/gstate.js';
import { clearMessageWindow, glyphAt } from '../js/display.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, HELMET, ROCK, SCR_AMNESIA, SCR_EARTH, SCR_FIRE, SCR_STINKING_CLOUD, SPE_FORCE_BOLT, SPE_HEALING } from '../js/object_data.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { applyAreaScrollEffect } from '../js/scroll_area_effects.js';
import { advanceHeroSkill, ensureHeroSkills, practiceNeededToAdvance } from '../js/skills.js';
import { forceLearnSpell, knownSpell } from '../js/spell.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { installSwallowedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';


function room(t: TestContext, answers: readonly PromptAnswer[] = [], options: ObjectRoomOptions = {}) {
    freshObjectRoom({ left: 5, right: 25, top: 5, bottom: 15,
        hero: { uhp: 500, uhpmax: 500 }, flags: { verbose: true, tips: false },
        gameplaySeed: 17n, ...options });
    requirePlayingGame(game);
    const input = resetInputState();
    planInput(input, t, answers);
    return input;
}

async function scroll(type: number, overrides: KnownObjectOverrides = {}) {
    recordObjectKnowledge(type);
    return addInventoryObject(type, { initialize: false, ...overrides });
}

function floorRocks() {
    requirePlayingGame(game);
    const rocks = [];
    for (let x = 9; x <= 11; x++) for (let y = 9; y <= 11; y++) {
        rocks.push(...(game.level.objects[x]?.[y] || []).filter(object =>
            object.otyp === ROCK || object.otyp === BOULDER));
    }
    return rocks;
}

void test('confused fire consumes one scroll and burns the hero without an explosion', async t => {
    room(t);
    requirePlayingGame(game);
    game.u.confusionTurns = 10;
    const source = await scroll(SCR_FIRE, { quan: 2 });
    const monster = await createMonsterAt('jackal', 11, 10);
    const before = monster.mhp;

    const result = await applyAreaScrollEffect(source);

    assert.equal(source.quan, 1);
    assert.equal(game.u.uhp, 499);
    assert.equal(monster.mhp, before);
    assert.equal(result.consumed, true);
    assert.match(game._pending_message, /burn your hands/);
});

void test('confused fire underwater is harmless even without fire resistance', async t => {
    room(t);
    requirePlayingGame(game);
    game.u.confusionTurns = 10;
    game.u.uinwater = true;

    await applyAreaScrollEffect(await scroll(SCR_FIRE));

    assert.equal(game.u.uhp, 500);
    assert.match(game._pending_message, /A little water around you vaporizes/);
});

void test('confused fire resistance is visible to nearby monsters', async t => {
    room(t);
    requirePlayingGame(game);
    game.u.confusionTurns = 10;
    grantIntrinsicProperty('fireResistance', 'outside');
    const monster = await createMonsterAt('jackal', 11, 10);
    vision_recalc(0);

    await applyAreaScrollEffect(await scroll(SCR_FIRE));

    assert.equal(game.u.uhp, 500);
    assert.ok(monster.seen_resistance != null, 'Expected monster.seen_resistance to be initialized');
    assert.ok(monster.seen_resistance & 2);
    assert.match(game._pending_message, /pretty fire in your hands/);
});

void test('life saving survives fatal confused fire after its scroll has been consumed', async t => {
    room(t, [
        { prompt: /amulet of life saving.*being worn/, keys: ' ' },
        { prompt: /scroll catches fire and you burn your hands/, keys: ' ' },
        { prompt: /You die.*But wait.*medallion begins to glow/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    game.u.uhp = 1;
    game.u.confusionTurns = 4;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const source = await scroll(SCR_FIRE);

    const result = await applyAreaScrollEffect(source);

    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(game.inventory.includes(source), false);
});

void test('blessed fire targets a distant explosion after consuming its scroll', async t => {
    const input = room(t);
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 14, 10);
    monster.mhp = monster.mhpmax = 500;
    const source = await scroll(SCR_FIRE, { blessed: true });
    vision_recalc(0);
    input.display = null;
    const effect = applyAreaScrollEffect(source);
    await input.waitUntilBlocked();
    assert.equal(game.inventory.includes(source), false);
    assert.equal(game.u.uhp, 500);
    assert.equal(monster.mhp, 500);
    input.feed(' llll.');

    const result = await effect;

    assert.equal(result.consumed, true);
    assert.equal(game.inventory.includes(source), false);
    assert.equal(game.u.uhp, 500);
    assert.ok(monster.mhp <= 485 && monster.mhp >= 475);
});

void test('cancelling blessed fire targeting returns the explosion to the reader', async t => {
    const input = room(t);
    requirePlayingGame(game);
    const source = await scroll(SCR_FIRE, { blessed: true });
    input.feed(' \x1b');

    await applyAreaScrollEffect(source);

    assert.ok(game.u.uhp < 500);
    assert.equal(game.inventory.includes(source), false);
});

for (const [blessed, cursed, expected] of [[false, false, 9], [true, false, 8], [false, true, 1]] as const) {
    void test(`earth drops ${expected} boulders for blessed=${blessed}, cursed=${cursed}`, async t => {
        room(t);
        requirePlayingGame(game);

        const result = await applyAreaScrollEffect(await scroll(SCR_EARTH, { blessed, cursed }));

        assert.equal(result.known, true);
        assert.equal(result.consumed, false);
        assert.equal(floorRocks().length, expected);
        assert.equal(game.u.uhp === 500, blessed);
    });
}

void test('blessed earth skips blocked squares and penalizes Sokoban creation once', async t => {
    room(t);
    requirePlayingGame(game);
    game.level.flags.sokoban_rules = true;
    game.level.requireAt(9, 9).typ = STONE;
    const doorSquare = game.level.requireAt(10, 9);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_CLOSED;
    const luck = game.u.uluck || 0;

    await applyAreaScrollEffect(await scroll(SCR_EARTH, { blessed: true }));

    assert.equal(floorRocks().length, 6);
    assert.equal(game.u.uluck, luck - 1);
    assert.equal(game.u.uconduct.sokocheat, 1);
});

void test('an earth boulder fills a real pit instead of remaining on its surface', async t => {
    room(t);
    requirePlayingGame(game);
    const pit = addTrap(game.level, PIT, 11, 10);

    await applyAreaScrollEffect(await scroll(SCR_EARTH, { blessed: true }));

    assert.equal(game.level.traps.includes(pit), false);
    assert.equal(game.level.objects[11]?.[10]?.some(object => object.otyp === BOULDER) || false, false);
    assert.equal(floorRocks().length, 7);
});

void test('earth helmets protect from ordinary falling boulders but not cursed ones', async t => {
    room(t, [
        { prompt: /ceiling rumbles above you.*hit by a boulder/, keys: ' ' },
        { prompt: /wearing a hard helmet/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    const helmet = await addInventoryObject(HELMET, { initialize: false, owornmask: W_ARMH });
    game.uarmh = helmet;

    await applyAreaScrollEffect(await scroll(SCR_EARTH));
    assert.equal(game.u.uhp, 498);

    await applyAreaScrollEffect(await scroll(SCR_EARTH, { cursed: true }));
    assert.ok(game.u.uhp < 496);
});

void test('confused earth drops piles of rocks and solid monsters receive helmet protection', async t => {
    room(t, [
        { prompt: /ceiling rumbles around you.*hobgoblin is hit by \d+ rocks/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    game.u.confusionTurns = 4;
    const monster = await createMonsterAt('hobgoblin', 11, 10);
    monster.mhp = monster.mhpmax = 100;
    await equipMonsterObject(monster, await knownObject(HELMET), W_ARMH);
    vision_recalc(0);

    await applyAreaScrollEffect(await scroll(SCR_EARTH, { blessed: true }));

    assert.equal(monster.mhp, 98);
    assert.equal(floorRocks().length, 8);
    for (const rock of floorRocks()) {
        assert.equal(rock.otyp, ROCK);
        assert.ok(rock.quan >= 2 && rock.quan <= 6);
    }
});

void test('an insubstantial swallower lets the cursed earth boulder fall through onto the hero', async t => {
    room(t);
    requirePlayingGame(game);
    const monster = await createMonsterAt('fog cloud', 11, 10);
    monster.mhp = monster.mhpmax = 100;
    await installSwallowedHero(monster);

    await applyAreaScrollEffect(await scroll(SCR_EARTH, { cursed: true }));

    assert.equal(monster.mhp, 100);
    assert.ok(game.u.uhp < 500);
    assert.equal(floorRocks().length, 1);
});

void test('an insubstantial hero remains unharmed while an earth boulder reaches the floor', async t => {
    room(t);
    requirePlayingGame(game);
    setHeroSpecies(MONSTER_NAME.indexOf('fog cloud'));
    game.u.mh = game.u.mhmax = 100;

    await applyAreaScrollEffect(await scroll(SCR_EARTH, { cursed: true }));

    assert.equal(game.u.mh, 100);
    assert.equal(floorRocks().length, 1);
});

void test('earth has no effect on the Rogue level', async t => {
    room(t);
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };

    const result = await applyAreaScrollEffect(await scroll(SCR_EARTH));

    assert.equal(result.known, false);
    assert.equal(floorRocks().length, 0);
    assert.equal(game.u.uhp, 500);
});

for (const [blessed, cursed, size, damage] of [[false, true, 5, 4], [false, false, 15, 8], [true, false, 25, 12]] as const) {
    void test(`stinking cloud creates ${size} real poisonous cells`, async t => {
        const input = room(t);
        requirePlayingGame(game);
        const source = await scroll(SCR_STINKING_CLOUD, { blessed, cursed });
        input.feed(' lll.');

        const result = await applyAreaScrollEffect(source);

        assert.equal(result.known, true);
        assert.equal(result.consumed, false);
        const cloud = game.level.regions[0];
        assert.ok(cloud != null, 'Expected cloud to be initialized');
        assert.equal(cloud.cells.length, size);
        assert.equal(cloud.damage, damage);
        assert.equal(cloud.heroFault, true);
        assert.ok(cloud.ttl >= 4 && cloud.ttl <= 6);
        assert.ok(cloud.cells.some(cell => cell.x === 13 && cell.y === 10));
    });
}

for (const keys of ['\x1b', 'llllll.']) {
    void test(`cancelled or out-of-range stinking cloud creates no region (${JSON.stringify(keys)})`, async t => {
        const input = room(t);
        requirePlayingGame(game);
        const source = await scroll(SCR_STINKING_CLOUD);
        input.feed(` ${keys}`);

        const result = await applyAreaScrollEffect(source);

        assert.equal(result.known, true);
        assert.equal(game.level.regions?.length || 0, 0);
        assert.match(game._pending_message, keys === '\x1b' ? /Never mind/ : /whiff of rotten eggs/);
    });
}

void test('cloud targeting leaves the steed unmarked and refreshes its hallucination on exit', async t => {
    room(t, [], { role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    clearMessageWindow();
    game.u.hallucinationTurns = 20;
    const source = await scroll(SCR_STINKING_CLOUD);
    const input = resetInputState();
    input.feed(' $');
    const reading = applyAreaScrollEffect(source);
    await input.waitUntilBlocked();
    const marked = glyphAt(game.u.ux, game.u.uy);
    input.feed('\x1b');
    await reading;
    const restored = glyphAt(game.u.ux, game.u.uy);

    assert.ok(marked?.kind === 'monster', 'Target marks leave the visible steed on screen.');
    assert.ok(restored?.kind === 'monster');
    assert.notEqual(restored.mnum, marked.mnum, 'Ending targeting refreshes the hallucinated steed.');
    assert.equal(game.level.regions.length, 0);
});

void test('cloud spreads through corridors and doors and announces a newly enveloped reader', async t => {
    const input = room(t);
    requirePlayingGame(game);
    for (let x = 5; x <= 25; x++) for (let y = 5; y <= 15; y++)
        game.level.requireAt(x, y).typ = STONE;
    for (let x = 8; x <= 12; x++) game.level.requireAt(x, 10).typ = CORR;
    const doorSquare = game.level.requireAt(9, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_CLOSED;
    vision_recalc(0);
    input.feed(' .');

    await applyAreaScrollEffect(await scroll(SCR_STINKING_CLOUD, { cursed: true }));

    assert.ok(game.level.regions[0] != null);
    assert.equal(game.level.regions[0].cells.length, 5);
    assert.ok(game.level.regions[0].cells.some(cell => cell.x === 8));
    assert.match(game._pending_message, /enveloped in a cloud of noxious gas/);
});

void test('blessed amnesia retains spells and forgets trained skills and monster recognition', async t => {
    room(t, [
        { prompt: /more skilled in dagger/, keys: ' ' },
        { prompt: /forget your training in dagger/, keys: ' ' },
    ], { role: 'rogue' });
    requirePlayingGame(game);
    forceLearnSpell(SPE_FORCE_BOLT);
    const skills = ensureHeroSkills(game);
    assert.ok(skills != null, 'Expected skills to be initialized');
    const dagger = skills[P_DAGGER];
    game.u.weapon_slots = 10;
    assert.ok(dagger != null, 'Expected dagger to be initialized');
    dagger.advance = practiceNeededToAdvance(dagger.skill);
    await advanceHeroSkill(game, P_DAGGER);
    const trainedLevel = dagger.skill;
    const spentSlots = game.u.weapon_slots;
    const monster = await createMonsterAt('jackal', 11, 10);
    monster.meverseen = 1;
    const held = await createMonsterAt('python', 9, 10);
    held.meverseen = 1;
    game.u.ustuck = held;

    await applyAreaScrollEffect(await scroll(SCR_AMNESIA, { blessed: true }));

    assert.equal(knownSpell(SPE_FORCE_BOLT), 'fresh');
    assert.equal(dagger.skill, trainedLevel - 1);
    assert.ok(dagger.advance < practiceNeededToAdvance(dagger.skill));
    assert.ok(game.u.weapon_slots > spentSlots);
    assert.equal(monster.meverseen, 0);
    assert.equal(held.meverseen, 1);
});

void test('ordinary amnesia clears retained study and keeps the spell entries when memory is lost', async t => {
    room(t);
    requirePlayingGame(game);
    forceLearnSpell(SPE_FORCE_BOLT);
    forceLearnSpell(SPE_HEALING);
    const book = await addInventoryObject(SPE_FORCE_BOLT);
    game.context.spbook = { book, o_id: book.o_id, delay: -8 };
    let forgotten = false;
    for (let count = 0; count < 12 && !forgotten; count++) {
        await applyAreaScrollEffect(await scroll(SCR_AMNESIA));
        forgotten = game.spells.some(spell => knownSpell(spell.otyp) === 'forgotten');
    }

    assert.equal(game.context.spbook.book, null);
    assert.equal(game.context.spbook.o_id, 0);
    assert.equal(game.context.spbook.delay, -8);
    assert.equal(game.spells.length, 2);
    assert.ok(game.spells[0] != null);
    assert.equal(game.spells[0].otyp, SPE_FORCE_BOLT);
    assert.ok(game.spells[1] != null);
    assert.equal(game.spells[1].otyp, SPE_HEALING);
    assert.equal(forgotten, true);
});
