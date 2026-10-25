import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CRYSTAL_BALL, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { ALTAR, M_AP_FURNITURE, ROOM } from '../js/const.js';
import { objectTypeKnown } from '../js/shk.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { glyphAt, newsym } from '../js/display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('invoking a crystal ball while blind spends a turn without using a charge', async (t) => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    const ball = await addInventoryObject(CRYSTAL_BALL, { spe: 3 });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [{ prompt: /What do you want to invoke\?/, keys: ball.invlet }]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, "Too bad you can't see the crystal ball.");
    assert.equal(ball.spe, 3);
    assert.equal(game.context.move, 1);
});
for (const command of ['apply', 'invoke']) {
    void test(`${command} looks for objects through a charged crystal ball`, async (t) => {
        freshObjectRoom({ flags: { verbose: false }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
        const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 3 });
        const input = resetInputState();
        if (command === 'invoke')
            input.feed('invoke\r');
        planInput(input, t, [
            { prompt: /What do you want to (use or apply|invoke)\?/, keys: ball.invlet },
            { prompt: /What do you look for\?/, keys: ')' },
        ]);
        await rhack((command === 'invoke' ? '#' : 'a').charCodeAt(0));
        assert.match(game._pending_message, /The vision is unclear\.$/);
        assert.equal(ball.spe, 2);
        assert.ok((game._helplessTurns ?? 0) >= 1 && (game._helplessTurns ?? 0) <= 10);
        assert.equal(game._helplessReason, 'gazing into a crystal ball');
        assert.equal(game.context.move, 1);
    });
}
// C detect.c:object_detect() describes a gem-class search with
// def_oc_syms[GEM_CLASS].name, which is "rocks", not "gems".
void test('a gem-class crystal-ball search under the hero senses rocks', async (t) => {
    freshObjectRoom({ flags: { verbose: false }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
    await floorObject(OBJECT_NAMES.indexOf('ruby'), game.u.ux, game.u.uy);
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2 });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: '*' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._lastPlineMessage, 'You sense rocks nearby.');
    assert.equal(ball.spe, 1);
    assert.equal(game.context.move, 1);
});
void test('cancelling a crystal-ball search preserves its charges and takes one turn', async (t) => {
    freshObjectRoom({ flags: { verbose: false }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2 });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: '\x1b' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(ball.spe, 2);
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game.context.move, 1);
});
void test('verbose crystal-ball help is acknowledged before a cancelled search', async (t) => {
    freshObjectRoom({ flags: { verbose: true }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2 });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What do you want to use or apply\?/, keys: ball.invlet },
        { prompt: /You may look for an object, monster, or special map symbol\.--More--/, keys: ' ' },
        { prompt: /What do you look for\?/, keys: '\x1b' },
    ]);
    await rhack('a'.charCodeAt(0));
    assert.equal(ball.spe, 2);
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game._pending_message, 'Never mind.');
    assert.equal(game.context.move, 1);
});
void test('a cancelled crystal ball implodes when used without harming the hero', async (t) => {
    freshObjectRoom({ flags: { verbose: false } });
    const ball = await addInventoryObject(CRYSTAL_BALL, { spe: -1 });
    const hp = game.u.uhp;
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: ')' },
        { prompt: /The vision is unclear\.--More--/, keys: ' ' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.match(game._pending_message, /The crystal ball implodes!$/);
    assert.equal(game.inventory.includes(ball), false);
    assert.equal(game.u.uhp, hp);
    assert.ok((game._helplessTurns ?? 0) > 0);
});
void test('a hallucinating hero gazes into an empty crystal ball without a search prompt', async (t) => {
    freshObjectRoom({ hero: { hallucinationTurns: 10 } });
    const ball = await addInventoryObject(CRYSTAL_BALL, { spe: 0 });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [{ prompt: /What do you want to invoke\?/, keys: ball.invlet }]);
    await rhack('#'.charCodeAt(0));
    assert.match(game._pending_message, /^All you see is funky .+ haze\.$/);
    assert.equal(ball.spe, 0);
    assert.equal(game._helplessReason, 'gazing into a Magic 8-Ball (tm)');
    assert.ok((game._helplessTurns ?? 0) > 0);
});
void test('a cursed charged crystal ball can confuse, blind, hallucinate, or explode', async (t) => {
    const outcomes = new Set();
    for (let seed = 1; seed <= 80 && outcomes.size < 5; seed++) {
        freshObjectRoom();
        const ball = await addInventoryObject(CRYSTAL_BALL, { cursed: true, spe: 2 });
        initRng(seed);
        const hp = game.u.uhp;
        assert.ok(hp !== undefined);
        const input = resetInputState();
        input.feed('invoke\r');
        planInput(input, t, [{ prompt: /What do you want to invoke\?/, keys: ball.invlet }]);
        await rhack('#'.charCodeAt(0));
        const message = game._pending_message;
        if (message.includes('too much to comprehend'))
            outcomes.add('overwhelmed');
        else if (message.includes('confuses you')) {
            assert.ok((game.u.confusionTurns ?? 0) > 0);
            outcomes.add('confused');
        }
        else if (message.includes('damages your vision')) {
            assert.ok((game.u.blindTurns ?? 0) > 0);
            outcomes.add('blind');
        }
        else if (message.includes('zaps your mind')) {
            assert.ok((game.u.hallucinationTurns ?? 0) > 0);
            outcomes.add('hallucinating');
        }
        else {
            assert.match(message, /The crystal ball explodes!/);
            assert.equal(game.inventory.includes(ball), false);
            const remaining = game.u.uhp;
            assert.ok(remaining !== undefined && remaining < hp);
            outcomes.add('exploded');
        }
        if (game.inventory.includes(ball))
            assert.equal(ball.spe, 1);
        assert.equal(game._helplessTurns ?? 0, 0);
        assert.equal(game.context.move, 1);
    }
    assert.equal(outcomes.size, 5, 'All five native cursed-ball effects must be reachable');
});
void test('a charged hallucinated vision consumes one charge without identifying the ball', async (t) => {
    freshObjectRoom({ hero: { hallucinationTurns: 10, acurr: { a: [12, 12, 12, 18, 12, 12] } } });
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2, known: false, typeKnown: false });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [{ prompt: /What do you want to invoke\?/, keys: ball.invlet }]);
    await rhack('#'.charCodeAt(0));
    assert.equal(ball.spe, 1);
    assert.equal(objectTypeKnown(ball), false);
    assert.equal(game._helplessReason, 'gazing into a Magic 8-Ball (tm)');
});
void test('an unknown search symbol shows a distant special level and identifies the ball', async (t) => {
    freshObjectRoom({ flags: { verbose: false }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
    const destination = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: 0 };
    game.oracle_level = destination;
    game.medusa_level = destination;
    game.stronghold_level = destination;
    game.specialLevels = new Map([['wizard1', destination]]);
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2, known: false, typeKnown: false });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: '8' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.match(game._pending_message, /You see (Delphi|Medusa's lair|a castle|the Wizard of Yendor's tower), near you\.$/);
    assert.equal(objectTypeKnown(ball), true);
    assert.equal(ball.spe, 1);
});
void test('searching for furniture reveals a distant altar and exposes a furniture mimic', async (t) => {
    const level = freshObjectRoom({ flags: { verbose: false }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
    const altar = level.requireAt(30, 10);
    altar.typ = ALTAR;
    altar.seenv = 0;
    const mimic = await createMonsterAt(MONSTER_NAME.indexOf('small mimic'), 14, 10);
    level.requireAt(14, 10).typ = ROOM;
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = CmapSymbol.fountain;
    newsym(14, 10);
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2 });
    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: '_' },
        { prompt: /You peer into the crystal ball\.\.\.(?!-)/, keys: '\x1b' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(altar.remembered_glyph?.kind, 'terrain');
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(glyphAt(30, 10)?.kind, 'terrain');
    assert.equal(ball.spe, 1);
});
//# sourceMappingURL=crystal_ball.test.js.map