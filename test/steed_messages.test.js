import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { strikeSteed } from '../js/steed.js';
import { runExtendedCommand } from './support/commands.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function mountedSteed(species, female = false) {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const steed = await createSaddledSteed(species);
    steed.female = female;
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, steed);
    return steed;
}
for (const { species, female, subject, reflexive } of [
    { species: 'forest centaur', female: false, subject: 'He', reflexive: 'himself' },
    { species: 'forest centaur', female: true, subject: 'She', reflexive: 'herself' },
    { species: 'pony', female: true, subject: 'It', reflexive: 'itself' },
]) {
    for (const { condition, frozen, response, remaining } of [
        { condition: 'permanently paralyzed', frozen: 0, response: 'does not respond.', remaining: 0 },
        { condition: 'still paralyzed', frozen: 4, response: 'stirs.', remaining: 2 },
        { condition: 'recovering', frozen: 2, response: `rouses ${reflexive}!`, remaining: 0 },
    ]) {
        void test(`kicking a ${condition} ${female ? 'female' : 'male'} ${species} uses ${subject}`, async () => {
            const steed = await mountedSteed(species, female);
            steed.mcanmove = 0;
            steed.mfrozen = frozen;
            initRng(4);
            const messages = [];
            await strikeSteed({ announce: message => { messages.push(message); } });
            assert.deepEqual(messages, [`${subject} ${response}`]);
            assert.equal(steed.mfrozen, remaining);
            assert.equal(steed.mcanmove, frozen === 2 ? 1 : 0);
        });
    }
}
void test('an unseen humanoid steed is referred to as it when kicked', async () => {
    const steed = await mountedSteed('forest centaur', true);
    steed.minvis = true;
    steed.mcanmove = 0;
    steed.mfrozen = 2;
    initRng(4);
    const messages = [];
    await strikeSteed({ announce: message => { messages.push(message); } });
    assert.deepEqual(messages, ['It rouses itself!']);
    assert.equal(steed.mcanmove, 1);
});
void test('hallucination independently changes a waking steed\'s subject and reflexive pronouns', async () => {
    const steed = await mountedSteed('forest centaur');
    game.u.hallucinationTurns = 20;
    initRng(1234);
    const messages = new Set();
    for (let attempt = 0; attempt < 64; attempt++) {
        steed.mcanmove = 0;
        steed.mfrozen = 2;
        await strikeSteed({ announce: message => { messages.add(message); } });
    }
    assert.ok(messages.has('He rouses herself!') || messages.has('She rouses himself!'), 'hallucination can give the subject and reflexive different genders');
    assert.ok([...messages].some(message => message.endsWith('rouse themselves!')), 'a plural hallucinated reflexive uses a plural verb');
});
for (const { female, pronoun } of [{ female: false, pronoun: 'he' }, { female: true, pronoun: 'she' }]) {
    void test(`a trapped ${female ? 'female' : 'male'} steed is described as ${pronoun}`, async () => {
        const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
        const steed = await createSaddledSteed('forest centaur');
        steed.female = female;
        steed.mtrapped = 1;
        addTrap(level, BEAR_TRAP, steed.mx, steed.my);
        await runExtendedCommand('ride', 'l');
        assert.match(game._last_message, new RegExp(`while ${pronoun}'s trapped in a bear trap\\.`));
        assert.ok(!game.u.usteed);
    });
}
void test('a kicked steed gallops under its saddled name', async () => {
    await mountedSteed('pony');
    const messages = [];
    await strikeSteed({ announce: message => { messages.push(message); } });
    assert.deepEqual(messages, ['The saddled pony gallops!']);
    assert.ok((game.u.ugallop ?? 0) > 0);
});
void test('kicking a barely tame steed throws the hero and wounds both legs', async () => {
    const steed = await mountedSteed('pony');
    steed.mtame = 1;
    const health = game.u.uhp ?? 0;
    await runExtendedCommand('kick', 'y');
    assert.match(game._pending_message, /You kick the saddled pony\.  You are thrown off of the saddled pony!/);
    assert.equal(game.u.usteed, null);
    assert.equal(steed.mtame, 0);
    assert.ok((game.u.uhp ?? 0) <= health - 10 && (game.u.uhp ?? 0) >= health - 19, 'riding accident damage is rn1(10,10)');
    const turns = game.u._woundedLegTurns ?? 0;
    assert.ok(turns >= 5 && turns <= 9, 'both legs are wounded for rn1(5,5) turns');
    assert.equal(game.u._woundedLegSide, 'both');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=steed_messages.test.js.map