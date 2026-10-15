import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, POOL, WATER } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function observeMessages(expected) {
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    installPagerInput(input, { expected, limit: 8 });
    return () => [...messages, game._pending_message].join('\n');
}
async function startSearching() {
    pushKeys('5s');
    await rhack(0);
    assert.ok(game._occupation, 'counted searching must start an occupation');
    return game._occupation;
}
for (const { roll, verbose, feedback } of [
    { roll: 11, verbose: true, feedback: 'The grid bug just misses!' },
    { roll: 12, verbose: true, feedback: 'The grid bug misses!' },
    { roll: 11, verbose: false, feedback: 'The grid bug misses!' },
]) {
    void test(`grid bug miss with roll ${roll} and verbose=${verbose} uses ordinary miss rules`, async () => {
        freshObjectRoom({ flags: { verbose }, hero: { uac: 0 } });
        requirePlayingGame(game);
        const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        bug.m_lev = 1;
        bug.mux = game.u.ux;
        bug.muy = game.u.uy;
        await startSearching();
        const messages = observeMessages(/grid bug|stop searching/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(bug, game, { rollOne: () => roll });
        assert.ok(messages().includes(feedback), messages());
        assert.equal(game.u.uhp, hp);
        assert.equal(game._occupation, null, 'an ordinary miss interrupts searching');
    });
}
for (const cancelled of [false, true]) {
    void test(`${cancelled ? 'cancelled' : 'uncancelled'} nymph misses preserve the native seduction distinction`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uac: 0 } });
        requirePlayingGame(game);
        const nymph = await createMonsterAt('mountain nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        nymph.m_lev = 1;
        nymph.mcan = cancelled;
        nymph.mux = game.u.ux;
        nymph.muy = game.u.uy;
        await startSearching();
        const messages = observeMessages(/nymph|stop searching/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(nymph, game, { rollOne: () => 20 });
        const text = messages();
        if (cancelled) {
            assert.match(text, /The mountain nymph misses!/);
            assert.doesNotMatch(text, /pretends to be friendly/);
        }
        else {
            assert.match(text, /The mountain nymph pretends to be friendly\./);
            assert.doesNotMatch(text, /nymph misses!/);
        }
        assert.equal(game.u.uhp, hp);
        assert.equal(game._occupation, null);
    });
}
for (const middleMiss of [true, false]) {
    void test(`a xorn's consecutive claw hits ${middleMiss ? 'lose' : 'retain'} repeated-hit wording${middleMiss ? ' across a miss' : ''}`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uac: 0 } });
        requirePlayingGame(game);
        const xorn = await createMonsterAt('xorn', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        xorn.m_lev = 1;
        xorn.mux = game.u.ux;
        xorn.muy = game.u.uy;
        const messages = observeMessages(/xorn/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(xorn, game, {
            rollOne: sides => sides === 23 || (middleMiss && sides === 21) ? sides : 1,
            rollDice: count => count,
        });
        const text = messages();
        if (middleMiss) {
            assert.match(text, /The xorn hits!\s+The xorn misses!\s+The xorn hits!/);
            assert.doesNotMatch(text, /hits again!/);
        }
        else {
            assert.match(text, /The xorn hits!\s+The xorn hits again!\s+The xorn hits again!/);
        }
        assert.equal(game.u.uhp, hp - (middleMiss ? 2 : 3));
    });
}
void test('a barbed devil using a replacement claw does not call the hit a repeated attack', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 0 } });
    requirePlayingGame(game);
    const devil = await createMonsterAt('barbed devil', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    devil.mux = game.u.ux;
    devil.muy = game.u.uy;
    devil.mspec_used = 2;
    const messages = observeMessages(/barbed devil/);
    await performMonsterHeroAttack(devil, game, {
        rollOne: () => 1, rollDice: count => count,
    });
    assert.match(messages(), /The barbed devil hits!\s+The barbed devil hits!\s+The barbed devil stings!/);
    assert.doesNotMatch(messages(), /hits again!/);
});
void test('an unseen ordinary miss marks its source before interrupting searching', async () => {
    const level = freshObjectRoom({ hero: { uac: 0 } });
    requirePlayingGame(game);
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.m_lev = 1;
    bug.mux = game.u.ux;
    bug.muy = game.u.uy;
    await startSearching();
    bug.minvis = true;
    assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    const messages = observeMessages(/misses|stop searching/);
    await performMonsterHeroAttack(bug, game, { rollOne: () => 20 });
    assert.match(messages(), /misses!/);
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(game._occupation, null);
});
for (const { choice, feedback } of [
    { choice: 0, feedback: 'The grid bug snaps wildly and misses!' },
    { choice: 1, feedback: 'The grid bug attacks a spot beside you.' },
    { choice: 2, feedback: 'The grid bug strikes at thin air!' },
]) {
    void test(`a monster attacking an invisible hero's old location can say: ${feedback}`, async () => {
        const level = freshObjectRoom({ flags: { verbose: true } });
        requirePlayingGame(game);
        const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        bug.mux = 12;
        bug.muy = 10;
        grantIntrinsicProperty('invisible', 'outside');
        const occupation = await startSearching();
        const messages = observeMessages(/grid bug/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(bug, game, { random: limit => Math.min(choice, limit - 1) });
        assert.ok(messages().includes(feedback), messages());
        assert.equal(game.u.uhp, hp);
        assert.equal(game._occupation, occupation, 'attacking the wrong square does not interrupt occupation');
        assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    });
}
void test('a blind attacker can miss wildly even when the hero is visible', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.mcansee = false;
    bug.mux = 12;
    bug.muy = 10;
    const occupation = await startSearching();
    const messages = observeMessages(/grid bug/);
    await performMonsterHeroAttack(bug, game, { random: () => 0 });
    assert.match(messages(), /The grid bug snaps wildly and misses!/);
    assert.equal(game._occupation, occupation);
});
void test('a wild attack at a wall of water names the empty water', async () => {
    const level = freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.mux = 12;
    bug.muy = 10;
    level.requireAt(12, 10).typ = WATER;
    grantIntrinsicProperty('invisible', 'outside');
    const messages = observeMessages(/grid bug/);
    await performMonsterHeroAttack(bug, game, { random: limit => Math.min(2, limit - 1) });
    assert.match(messages(), /The grid bug strikes at empty water!/);
});
void test('displacement miss feedback leaves searching active', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { displaced: true } });
    requirePlayingGame(game);
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.mux = 12;
    bug.muy = 10;
    const occupation = await startSearching();
    const messages = observeMessages(/grid bug/);
    await performMonsterHeroAttack(bug, game);
    assert.match(messages(), /The grid bug strikes at your displaced image and misses you!/);
    assert.equal(game._occupation, occupation);
});
for (const species of ['killer bee', 'quivering blob']) {
    void test(`${species} stinging or touching a displaced image cannot damage the hero`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { displaced: true } });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mux = 12;
        monster.muy = 10;
        const occupation = await startSearching();
        const messages = observeMessages(/killer bee|quivering blob/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(monster, game, { rollOne: () => 1, rollDice: count => count });
        assert.match(messages(), /strikes at your displaced image and misses you!/);
        assert.equal(game.u.uhp, hp);
        assert.equal(game._occupation, occupation);
    });
}
void test('a monster that sees invisibility attacks the invisible displaced image', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { displaced: true } });
    requirePlayingGame(game);
    const stalker = await createMonsterAt('stalker', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    stalker.mux = 12;
    stalker.muy = 10;
    grantIntrinsicProperty('invisible', 'outside');
    grantIntrinsicProperty('seeInvisible', 'outside');
    const occupation = await startSearching();
    const messages = observeMessages(/stalker/);
    await performMonsterHeroAttack(stalker, game);
    assert.match(messages(), /strikes at your invisible displaced image and misses you!/);
    assert.equal(game._occupation, occupation);
});
void test('an underwater miss describes reflections and preserves occupation', async () => {
    const level = freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const elemental = await createMonsterAt('water elemental', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    elemental.mux = 12;
    elemental.muy = 10;
    for (const x of [10, 11, 12])
        level.requireAt(x, 10).typ = POOL;
    game.underwater = true;
    game.u.uinwater = true;
    vision_recalc(0);
    const occupation = await startSearching();
    const messages = observeMessages(/water elemental/);
    await performMonsterHeroAttack(elemental, game);
    assert.match(messages(), /The water elemental is fooled by water reflections and misses!/);
    assert.equal(game._occupation, occupation);
});
for (const reason of ['invisibility', 'displacement', 'underwater']) {
    void test(`a seducer's ${reason} wild miss uses its own feedback without interrupting`, async () => {
        const level = freshObjectRoom({ flags: { verbose: true, female: false } });
        requirePlayingGame(game);
        const seducer = await createMonsterAt(reason === 'underwater' ? 'water nymph' : 'amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        seducer.female = true;
        seducer.mux = 12;
        seducer.muy = 10;
        if (reason === 'invisibility')
            grantIntrinsicProperty('invisible', 'outside');
        if (reason === 'displacement')
            game.u.displaced = true;
        if (reason === 'underwater') {
            for (const x of [10, 11, 12])
                level.requireAt(x, 10).typ = POOL;
            game.underwater = true;
            game.u.uinwater = true;
            vision_recalc(0);
        }
        const occupation = await startSearching();
        const messages = observeMessages(/succubus|water nymph/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(seducer, game);
        const text = messages();
        if (reason === 'invisibility')
            assert.match(text, /tries to touch you and misses!/);
        if (reason === 'displacement')
            assert.match(text, /smiles seductively at your displaced image\.\.\./);
        if (reason === 'underwater')
            assert.match(text, /The water nymph is fooled by water reflections and misses!/);
        assert.equal(game._occupation, occupation);
        assert.equal(game.u.uhp, hp, 'the wrong location suppresses the later claw attacks too');
    });
}
for (const quietReason of ['verbose disabled', 'attacker square unseen']) {
    void test(`a wild miss is silent with ${quietReason}`, async () => {
        const level = freshObjectRoom({ flags: { verbose: quietReason !== 'verbose disabled' } });
        requirePlayingGame(game);
        const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        bug.mux = 12;
        bug.muy = 10;
        grantIntrinsicProperty('invisible', 'outside');
        const occupation = await startSearching();
        if (quietReason === 'attacker square unseen') {
            await makeBlinded(10, { talk: false });
        }
        const messages = observeMessages(/grid bug/);
        await performMonsterHeroAttack(bug, game);
        assert.equal(messages(), '');
        assert.equal(game._occupation, occupation);
        assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    });
}
for (const { species, unseen, deaf, feedback } of [
    { species: 'fog cloud', unseen: false, deaf: false, feedback: 'The fog cloud lunges forward and recoils!' },
    { species: 'fog cloud', unseen: true, deaf: false, feedback: 'You hear a rushing noise nearby.' },
    { species: 'ochre jelly', unseen: true, deaf: false, feedback: 'You hear a splat nearby.' },
    { species: 'fog cloud', unseen: true, deaf: true, feedback: '' },
]) {
    void test(`${unseen ? 'unseen' : 'visible'} ${species} engulfing the wrong square${deaf ? ' while the hero is deaf' : ''} does not use ordinary miss effects`, async () => {
        const level = freshObjectRoom({ flags: { verbose: false }, hero: { displaced: true } });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mux = 12;
        monster.muy = 10;
        game.u.deafTurns = deaf ? 10 : 0;
        const occupation = await startSearching();
        monster.minvis = unseen;
        assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
        const messages = observeMessages(/cloud|jelly|rushing noise|splat/);
        const hp = game.u.uhp;
        await performMonsterHeroAttack(monster, game);
        assert.equal(messages(), feedback);
        assert.equal(game.u.uhp, hp);
        assert.equal(!!game.u.uswallow, false);
        assert.equal(game._occupation, occupation);
        assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    });
}
//# sourceMappingURL=monster_miss_feedback.test.js.map