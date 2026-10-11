import { installPagerInput } from './support/pager-input.js';
import { touchFoodObject } from '../js/food_lifecycle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { moveloop_core } from '../js/allmain.js';
import { applyCannibalPenalty } from '../js/cannibalism.js';
import { A_INT, M_AP_OBJECT } from '../js/const.js';
import { applyCorpsePostEffects, applyCorpsePreEffects } from '../js/corpse_eating.js';
import { flushPendingTopline } from '../js/display.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { advanceDisplacementTimeout } from '../js/hero_displacement.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { takeMonsterTurn } from '../js/monmove.js';
import {
    AMULET_OF_LIFE_SAVING,
    CLOAK_OF_DISPLACEMENT,
    GOLD_PIECE,
    MUMMY_WRAPPING,
    ORANGE,
    TIN,
} from '../js/object_data.js';
import {
    grantIntrinsicProperty,
    hasIntrinsicProperty,
    propertyIsActive,
    propertyTimeout,
    setPropertyTimeout,
} from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { startHeroPetrification } from '../js/stoning.js';
import { addInventoryObject, untimedCorpse } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const species = (name: string) => MONSTER_NAME.indexOf(name);
function room(options = {}) {
    freshObjectRoom({ role: 'wizard', gameplaySeed: 71n, ...options });
    requirePlayingGame(game);
    game.plname = 'Ada';
    const input = resetInputState();
    installPagerInput(input, {
        expected:
            /But wait|The medallion crumbles|amulet of life saving|You feel |You seem |You turn |You return |Your medallion|Your amulet|amulet of life saving|amulet crumbles|stone|petrification|bad idea|Eating that is instantly fatal|You come back to life|You survive|rise from|rises from|cannibal|Cannibal|aggravate|Yum!|brain food|tasted bland|Oh wow|mimic|Mimic|Something |Wait, |corpse/,
        limit: 24,
    });
    return input;
}
const eatBefore = (name: string, options: Parameters<typeof applyCorpsePreEffects>[1] = {}) =>
    applyCorpsePreEffects(species(name), options);
const eatAfter = (name: string, options: Parameters<typeof applyCorpsePostEffects>[1] = {}) =>
    applyCorpsePostEffects(species(name), options);

void test('human flesh gives a human aggravation and one luck penalty per turn', async () => {
    room();
    requirePlayingGame(game);
    await eatBefore('human');
    const luck = game.u.uluck ?? 0;
    assert.ok(luck >= -5 && luck <= -2);
    assert.equal(propertyIsActive('aggravateMonster'), true);
    await eatBefore('human');
    assert.equal(game.u.uluck, luck);
});

void test('an earlier non-cannibal bite suppresses another cannibal check that turn', async () => {
    room();
    requirePlayingGame(game);
    assert.equal(await applyCannibalPenalty(species('lichen')), false);
    assert.equal(await applyCannibalPenalty(species('human')), false);
    assert.equal(game.u.uluck || 0, 0);
});

void test('cave dwellers may eat their own kind and domestic animals', async () => {
    room({ role: 'caveman' });
    requirePlayingGame(game);
    await eatBefore('human');
    game.moves++;
    await eatBefore('housecat');
    assert.equal(propertyIsActive('aggravateMonster'), false);
    assert.equal(game.u.uluck || 0, 0);
});

void test('a polymorphed hero still recognizes grown forms of its own species', async () => {
    room();
    requirePlayingGame(game);
    installPolymorphedHero('little dog');
    await eatBefore('large dog');
    assert.ok((game.u.uluck ?? 0) < 0);
    assert.equal(propertyIsActive('aggravateMonster'), true);
});

void test('domestic meat aggravates monsters without a cannibal luck penalty', async () => {
    room();
    requirePlayingGame(game);
    await eatBefore('kitten');
    assert.equal(propertyIsActive('aggravateMonster'), true);
    assert.equal(game.u.uluck || 0, 0);
});

for (const name of ['lizard', 'acid blob']) {
    void test(`${name} flesh cures an active petrification countdown`, async () => {
        room();
        requirePlayingGame(game);
        startHeroPetrification({ killer: 'cockatrice' });
        await eatBefore(name);
        assert.equal(game.u.stonedTurns, 0);
        assert.equal(game.u.stoneKiller, undefined);
        assert.match(game._pending_message, /You feel limber!/);
    });
}

void test('green slime begins the real ten-turn transformation', async () => {
    room();
    requirePlayingGame(game);
    await eatBefore('green slime');
    assert.equal(game.u.slimedTurns, 10);
    assert.equal(game.u.slimeKiller, '');
});

void test('a stone-resistant hero can continue eating petrifying flesh', async () => {
    room();
    requirePlayingGame(game);
    grantIntrinsicProperty('stoneResistance', 'outside');
    const result = await eatBefore('cockatrice');
    assert.equal(result.stopped, false);
    assert.equal(game.program_state.gameover, undefined);
});

void test('petrifying flesh changes a flesh golem into a stone golem', async () => {
    room();
    requirePlayingGame(game);
    installPolymorphedHero('flesh golem');
    const result = await eatBefore('cockatrice');
    assert.equal(result.stopped, false);
    assert.equal(game.u.umonnum, species('stone golem'));
});

void test('life saving stops a petrifying meal without removing its corpse', async () => {
    room();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const corpse = placeCreatedObject(
        await untimedCorpse(species('cockatrice')),
        game.u.ux,
        game.u.uy,
    );
    const piece = await touchFoodObject(corpse);
    assert.ok(piece);
    game.context.victual = {
        key: 'eat-food',
        piece,
        o_id: corpse.o_id,
        eating: true,
        reqtime: 1,
        usedtime: 0,
        nmod: 0,
        canchoke: false,
        fullwarn: false,
        doreset: false,
    };
    const result = await eatBefore('cockatrice', { food: corpse });
    assert.equal(result.stopped, true);
    assert.equal(result.heroDied, false);
    assert.equal(game.context.victual?.eating ?? false, false);
    assert.equal(corpse.where, 'floor');
    assert.equal(amulet.where, 'gone');
});

void test('petrifying tin contents consume the tin before a life-saved death', async () => {
    room();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const tin = await addInventoryObject(TIN, { corpsenm: species('cockatrice') });
    game.context.tin = {
        key: 'open-tin',
        text: 'opening the tin',
        object: tin,
        tin,
        o_id: tin.o_id,
        reqtime: 1,
        usedtime: 0,
    };
    const result = await eatBefore('cockatrice', { tin });
    assert.equal(result.heroDied, false);
    assert.equal(tin.where, 'gone');
    assert.equal(game.context.tin?.tin ?? null, null);
});

void test('a life-saved Rider meal revives its actual corpse and ends eating', async () => {
    room();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const corpse = placeCreatedObject(await untimedCorpse(species('Death')), game.u.ux, game.u.uy);
    const piece = await touchFoodObject(corpse);
    assert.ok(piece);
    game.context.victual = {
        key: 'eat-food',
        piece,
        o_id: corpse.o_id,
        eating: true,
        reqtime: 1,
        usedtime: 0,
        nmod: 0,
        canchoke: false,
        fullwarn: false,
        doreset: false,
    };
    const result = await eatBefore('Death', { food: corpse });
    assert.equal(result.heroDied, false);
    assert.equal(result.stopped, true);
    assert.equal(corpse.where, 'gone');
    assert.ok(
        requireGameLevel().monsters.some(
            (monster) => monster.mnum === species('Death') && monster.mhp > 0,
        ),
    );
    assert.equal(game.context.victual?.piece ?? null, null);
});

void test('a nurse heals the current body and clears blindness without removing cream', async () => {
    room({ hero: { uhp: 3, uhpmax: 40, blindTurns: 20, ucreamed: 5 } });
    requirePlayingGame(game);
    installPolymorphedHero('giant', { hitPoints: 3, maxHitPoints: 50 });
    await eatAfter('nurse');
    assert.equal(game.u.mh, 50);
    assert.equal(game.u.uhp, 3);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.u.ucreamed, 5);
});

void test('a stalker first grants timed invisibility, then permanent invisibility and sight', async () => {
    room();
    requirePlayingGame(game);
    await eatAfter('stalker');
    assert.ok((game.u.invisibleTurns ?? 0) >= 50 && (game.u.invisibleTurns ?? 0) <= 149);
    assert.equal(hasIntrinsicProperty('invisible', 'outside'), false);
    assert.equal(game.u.stunnedTurns, 60);
    await eatAfter('stalker');
    assert.equal(hasIntrinsicProperty('invisible', 'outside'), true);
    assert.equal(hasIntrinsicProperty('seeInvisible', 'outside'), true);
    assert.equal(game.u.stunnedTurns, 120);
});

void test('mummy wrapping prevents a second stalker from granting permanent invisibility', async () => {
    room();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(MUMMY_WRAPPING));
    await eatAfter('stalker');
    await eatAfter('stalker');
    assert.equal(hasIntrinsicProperty('invisible', 'outside'), false);
    assert.equal(game.u.invisible, false);
});

void test('bat and giant bat corpses add their distinct stun durations', async () => {
    room();
    requirePlayingGame(game);
    await eatAfter('bat');
    assert.equal(game.u.stunnedTurns, 30);
    await eatAfter('giant bat');
    assert.equal(game.u.stunnedTurns, 90);
});

void test('quantum meat toggles permanent speed while retaining form and timed speed', async () => {
    room();
    requirePlayingGame(game);
    setPropertyTimeout('fast', 20);
    grantIntrinsicProperty('fast', 'form');
    await eatAfter('quantum mechanic');
    assert.equal(hasIntrinsicProperty('fast', 'outside'), true);
    await eatAfter('quantum mechanic');
    assert.equal(hasIntrinsicProperty('fast', 'outside'), false);
    assert.equal(hasIntrinsicProperty('fast', 'form'), true);
    assert.equal(propertyTimeout('fast'), 20);
    assert.equal(game.u.fast, true);
});

void test('a disenchanter strips one permanent intrinsic while leaving form powers', async () => {
    room();
    requirePlayingGame(game);
    const properties = [
        'fireResistance',
        'teleportation',
        'poisonResistance',
        'telepathy',
        'coldResistance',
        'invisible',
        'seeInvisible',
        'fast',
        'stealth',
        'protection',
        'aggravateMonster',
    ] as const;
    for (const property of properties) {
        grantIntrinsicProperty(property, 'outside');
        grantIntrinsicProperty(property, 'form');
    }
    await eatAfter('disenchanter');
    assert.equal(
        properties.filter((property) => hasIntrinsicProperty(property, 'outside')).length,
        10,
    );
    assert.ok(properties.every((property) => hasIntrinsicProperty(property, 'form')));
});

void test('lizard meat limits confusion and stun without increasing short timers', async () => {
    room({ hero: { confusionTurns: 1, stunnedTurns: 20 } });
    requirePlayingGame(game);
    await eatAfter('lizard');
    assert.equal(game.u.confusionTurns, 1);
    assert.equal(game.u.stunnedTurns, 2);
});

void test('unchanging prevents a chameleon meal from transforming the hero', async () => {
    room();
    requirePlayingGame(game);
    grantIntrinsicProperty('unchanging', 'outside');
    const form = game.u.umonnum;
    await eatAfter('chameleon');
    assert.equal(game.u.umonnum, form);
    assert.match(game._pending_message, /momentarily different/);
});

void test('a displacer beast grants a temporary effect which expires', async () => {
    room();
    requirePlayingGame(game);
    await eatAfter('displacer beast');
    const duration = game.u.displacedTurns ?? 0;
    assert.ok(duration >= 6 && duration <= 36);
    for (let i = 0; i < duration; i++) await advanceDisplacementTimeout();
    assert.equal(game.u.displacedTurns, 0);
    assert.equal(game.u.displaced, false);
    assert.match(game._pending_message, /no longer have difficulty pinpointing/);
});

void test('displacement from worn armor survives a corpse timeout', async () => {
    room();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(CLOAK_OF_DISPLACEMENT));
    game.u.displacedTurns = 1;
    await advanceDisplacementTimeout();
    assert.equal(game.u.displaced, true);
});

void test('violet fungus gives hallucination through the ordinary post-effect branch', async () => {
    room();
    requirePlayingGame(game);
    await eatAfter('violet fungus');
    assert.equal(game.u.hallucinationTurns, 200);
});

void test('mind flayer brain food can raise intelligence instead of granting telepathy', async () => {
    let improved = false;
    for (let seed = 1; seed <= 8 && !improved; seed++) {
        room();
        requirePlayingGame(game);
        game.u.acurr.a[A_INT] = 10;
        game.u.amax.a[A_INT] = 10;
        initRng(BigInt(seed));
        await eatAfter('mind flayer');
        improved = game.u.acurr.a[A_INT] === 11;
        if (improved) assert.equal(hasIntrinsicProperty('telepathy', 'outside'), false);
    }
    assert.equal(improved, true);
});

void test('a wraith grants a real experience level', async () => {
    room();
    requirePlayingGame(game);
    const before = game.u.ulevel;
    await eatAfter('wraith');
    assert.equal(game.u.ulevel, before + 1);
});

void test('human werewolf meat infects lycanthropy despite sharing its animal name', async () => {
    room();
    requirePlayingGame(game);
    await applyCorpsePostEffects(263);
    assert.equal(game.u.ulycn, 21);
    assert.equal(game.u.drainResistance, true);
});

void test('a mimic corpse waits for input with a real gold disguise already displayed', async () => {
    room();
    requirePlayingGame(game);
    const input = resetInputState();
    let completed = false;
    const effect = eatAfter('small mimic').then(() => {
        completed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(completed, false);
    assert.equal(game.u.m_ap_type, M_AP_OBJECT);
    assert.equal(game.u.mappearance, GOLD_PIECE);
    assert.equal(game._helplessTurns, 20);
    input.feed(' ');
    await effect;
});

void test('hallucination ending changes a mimicked orange back to gold', async () => {
    room();
    requirePlayingGame(game);
    await makeHallucinated(10, { talk: false });
    await eatAfter('large mimic');
    assert.equal(game.u.mappearance, ORANGE);
    await makeHallucinated(0, { talk: false });
    assert.equal(game.u.mappearance, GOLD_PIECE);
    assert.equal(game._helplessDoneMessage, 'You now prefer mimicking yourself.');
});

void test('an adjacent monster reveals meal mimicry instead of damaging the hero', async () => {
    room();
    requirePlayingGame(game);
    await eatAfter('small mimic');
    const monster = await createMonsterAt('jackal', 11, 10);
    monster.mpeaceful = 0;
    monster.mux = 10;
    monster.muy = 10;
    monster.movement = 12;
    const hp = game.u.uhp;
    await takeMonsterTurn(monster, game);
    assert.equal(game.u.uhp, hp);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game.u.m_ap_type, 0);
    assert.equal(game._mimicMealMessage, null);
});

void test('the real turn loop clears a finished mimic disguise after its recovery message', async () => {
    const input = room();
    requirePlayingGame(game);
    await eatAfter('small mimic');
    await flushPendingTopline();
    game._helplessTurns = 1;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.context.move = 0;
    input.feed('..');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.m_ap_type, 0);
    assert.equal(game._mimicMealMessage, null);
});
