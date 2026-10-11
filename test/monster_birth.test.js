import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_F_DKNOWN, M_AP_FURNITURE, M_AP_MONSTER, MM_ANGRY, MM_NOMSG, MM_NOEXCLAM, NO_MINVENT, } from '../js/const.js';
import { canSeeMonster, glyphAt, newsym, pline } from '../js/display.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { makemonAt } from '../js/mklev.js';
import { finishMonsterBirth } from '../js/monster_birth.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { makePlural } from '../js/object_grammar.js';
import { GOLD_PIECE, POT_HEALING } from '../js/object_data.js';
import { minimalObjectName } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
const species = (name) => MONSTER_NAME.indexOf(name);
for (const [description, flags, message] of [
    ['a normal runtime birth', 0, 'A goblin suddenly appears next to you!'],
    ['a birth without an exclamation', MM_NOEXCLAM, 'A goblin appears next to you.'],
    ['a silent runtime birth', MM_NOMSG, ''],
]) {
    void test(`${description} retains its map display`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const goblin = await makemonAt(species('goblin'), 11, 10, flags | NO_MINVENT);
        assert.ok(goblin);
        assert.ok(goblin);
        assert.ok(canSeeMonster(goblin));
        assert.equal(game._pending_message || '', message);
        assert.equal(glyphAt(11, 10)?.kind, 'monster');
    });
}
void test('a sensed invisible birth announces its actual monster', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    requirePlayingGame(game);
    await makemonAt(species('stalker'), 11, 10, NO_MINVENT);
    assert.equal(game._pending_message, 'An invisible stalker suddenly appears next to you!');
});
void test('an unseen birth does not announce its arrival', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    await makemonAt(species('goblin'), 11, 10, NO_MINVENT);
    assert.equal(game._pending_message || '', '');
});
void test('a mimic birth names the unknown potion it resembles', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(POT_HEALING, 11, 10, { known: false, typeKnown: false });
    game._objectCallNames = { [POT_HEALING]: 'nectar' };
    await makemonAt(species('small mimic'), 11, 10, NO_MINVENT);
    assert.equal(game._pending_message, `A ${game.objectDescriptions?.[POT_HEALING]} potion suddenly appears next to you!`);
    assert.doesNotMatch(game._pending_message, /healing|nectar|mimic/);
});
void test('a coin disguise uses a plural arrival verb', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(GOLD_PIECE, 11, 10);
    await makemonAt(species('small mimic'), 11, 10, NO_MINVENT);
    assert.equal(game._pending_message, 'Gold pieces suddenly appear next to you!');
});
void test('a furniture disguise announces the displayed feature', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await makemonAt(species('small mimic'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(mimic);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = 15; // S_vcdoor
    await finishMonsterBirth(mimic, MM_NOEXCLAM);
    assert.equal(game._pending_message, 'A closed door appears next to you.');
});
void test('a monster disguise retains the sudden exclamation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await makemonAt(species('small mimic'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(mimic);
    mimic.m_ap_type = M_AP_MONSTER;
    mimic.mappearance = species('goblin');
    await finishMonsterBirth(mimic, MM_NOEXCLAM);
    assert.equal(game._pending_message, 'A goblin suddenly appears next to you!');
});
void test('a shapechanged newborn can see the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const vampire = await makemonAt(species('vampire'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(vampire);
    assert.notEqual(vampire.mnum, species('vampire'));
    assert.equal(vampire.mcansee, 1);
    assert.ok(canSeeMonster(vampire));
});
for (const protectedHero of [false, true]) {
    void test(`a hostile birth ${protectedHero ? 'respects Elbereth during' : 'interrupts'} occupation`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (protectedHero)
            makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
        const binding = game.commandBindings.lookup('s'.charCodeAt(0));
        assert.ok(binding?.command, 'the search command is available');
        game._occupation = { key: 'command', text: 'searching', binding };
        await makemonAt(species('goblin'), 11, 10, MM_NOMSG | NO_MINVENT | MM_ANGRY);
        assert.equal(Boolean(game._occupation), protectedHero);
        assert.equal(game._pending_message || '', protectedHero ? '' : 'You stop searching.');
    });
}
void test('a luminous birth lights nearby dark terrain on the next vision update', async () => {
    const level = freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    for (let x = 14; x <= 24; x++) {
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    }
    vision_recalc(0);
    assert.equal(cansee(17, 10), false);
    await makemonAt(species('flaming sphere'), 17, 10, MM_NOMSG | NO_MINVENT);
    vision_recalc(0);
    assert.equal(cansee(17, 10), true);
    assert.equal(cansee(18, 10), true);
});
void test('arrival input pauses after placement and before occupation interruption', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const binding = game.commandBindings.lookup('s'.charCodeAt(0));
    assert.ok(binding?.command, 'the search command is available');
    game._occupation = { key: 'command', text: 'searching', binding };
    await pline('A long message remains on the line while you search the surrounding floor.');
    const input = resetInputState();
    const creating = makemonAt(species('goblin'), 11, 10, NO_MINVENT | MM_ANGRY);
    try {
        const paused = await Promise.race([
            input.waitUntilBlocked().then(() => true),
            creating.then(() => false),
        ]);
        assert.equal(paused, true, 'the arrival should wait for the prior message');
        const goblin = game.level.monsters.find(monster => monster.mx === 11 && monster.my === 10);
        assert.ok(goblin);
        assert.ok(canSeeMonster(goblin));
        assert.ok(game._occupation);
    }
    finally {
        input.feed(' '.repeat(10));
        await creating;
    }
    assert.equal(game._occupation, null);
    assert.match(game._pending_message, /You stop searching/);
});
void test('random group births initialize sight for every member', async () => {
    let group;
    for (let seed = 1; seed <= 50 && !group; seed++) {
        freshObjectRoom({ right: 24, hero: { ulevel: 10 } });
        requirePlayingGame(game);
        initRng(BigInt(seed));
        await makemonAt(null, 16, 10, MM_NOMSG | NO_MINVENT);
        if (game.level.monsters.length > 1)
            group = game.level.monsters;
    }
    assert.ok(group, 'a random birth should exercise a native group species');
    assert.ok(group.every(monster => monster.mcansee === 1));
    assert.ok(group.every(monster => monster.mcanmove === 1 && monster.mhp > 0));
});
void test('terrain browsing does not teach the birth description a potion appearance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(POT_HEALING, 11, 10, { known: false, typeKnown: false });
    game.iflags.terrainmode = 1;
    await makemonAt(species('small mimic'), 11, 10, NO_MINVENT);
    assert.equal(game._pending_message, 'A potion suddenly appears next to you!');
});
void test('remembered mimic knowledge does not identify its hallucinated temporary object', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await makemonAt(species('small mimic'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(mimic);
    game.u.hallucinationTurns = 20;
    initRng(1n);
    newsym(11, 10);
    const glyph = game.level.requireAt(11, 10).remembered_glyph;
    assert.ok(glyph?.kind === 'object', 'the hallucinated mimic has an object disguise');
    mimic.mappearance = glyph.otyp;
    mimic.m_ap_type = (mimic.m_ap_type ?? 0) | M_AP_F_DKNOWN;
    initRng(1n);
    await finishMonsterBirth(mimic);
    assert.equal(game._pending_message, 'A spellbook suddenly appears next to you!');
    assert.equal(glyphAt(11, 10)?.kind, 'object');
    newsym(11, 10);
    assert.equal(glyphAt(11, 10)?.kind, 'object', 'remembered knowledge must retain the disguise on redraw');
});
void test('a hallucinated disguise matching real cargo uses and retains that stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(POT_HEALING, 11, 10, { known: false, typeKnown: false });
    const mimic = await makemonAt(species('small mimic'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(mimic);
    game.u.hallucinationTurns = 20;
    initRng(1n);
    newsym(11, 10);
    const glyph = game.level.requireAt(11, 10).remembered_glyph;
    assert.ok(glyph?.kind === 'object', 'the hallucinated mimic has an object disguise');
    const shownType = glyph.otyp;
    assert.notEqual(shownType, mimic.mappearance);
    const cargo = await floorObject(shownType, 11, 10, { quan: 3 });
    const description = makePlural(minimalObjectName(cargo));
    initRng(1n);
    await finishMonsterBirth(mimic);
    assert.equal(game._pending_message, `${description.charAt(0).toUpperCase()}${description.slice(1)} suddenly appear next to you!`);
    assert.equal(cargo.where, 'floor');
    assert.equal(cargo.quan, 3);
    assert.ok(floorObjectsAt(game.level, 11, 10).includes(cargo));
});
void test('a level without terrain memory names the currently displayed disguise', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.hero_memory = false;
    await floorObject(POT_HEALING, 11, 10, { known: false, typeKnown: false });
    await makemonAt(species('small mimic'), 11, 10, NO_MINVENT);
    assert.equal(game._pending_message, `A ${game.objectDescriptions?.[POT_HEALING]} potion suddenly appears next to you!`);
    assert.equal(glyphAt(11, 10)?.kind, 'object');
});
//# sourceMappingURL=monster_birth.test.js.map