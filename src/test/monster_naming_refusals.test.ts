import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { monsterLeashName, monsterName } from '../js/monster_name.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { RIN_PROTECTION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

// C do_name.c:alreadynamed()/do_mgivenname() refusal messages. A unique
// monster keeps its name or title when the player submits a blank line,
// a matching name, or the visible name without its "invisible" adjective.

async function nameMonsterAt(t: TestContext, keys: string): Promise<void> {
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#m');
    planInput(input, t, [
        { prompt: /instructions/, keys: 'l.' },
        { prompt: /What do you want to call/, keys: `${keys}\r` },
    ]);
    await rhack('#'.charCodeAt(0));
}

void test('erasing a unique monster name keeps its existing name', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const medusa = await createMonsterAt('Medusa', 11, 10, 0);
    await nameMonsterAt(t, ' ');

    assert.equal(game._pending_message, 'Medusa would rather keep her existing name.');
    assert.equal(medusa.mgivenname, undefined);
    assert.equal(game.context.move, 0);
});

void test('erasing a rider monster name uses the gender-neutral pronoun', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    await createMonsterAt('Death', 11, 10, 0);
    await nameMonsterAt(t, ' ');

    assert.equal(game._pending_message, 'Death would rather keep its existing name.');
});

void test('naming an invisible unique monster by its stripped name is refused', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const medusa = await createMonsterAt('Medusa', 11, 10, 0);
    medusa.minvis = true;
    game.u.seeInvisibleTurns = 100;
    await nameMonsterAt(t, 'Medusa');

    assert.equal(game._pending_message, 'She is already called the invisible Medusa.');
    assert.equal(medusa.mgivenname, undefined);
});

void test('naming Juiblex with its misspelled name is refused', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const juiblex = await createMonsterAt('Juiblex', 11, 10, 0);

    await nameMonsterAt(t, 'Jubilex');

    assert.equal(game._pending_message, "Juiblex doesn't like being called Jubilex.");
    assert.equal(juiblex.mgivenname, undefined);
});

void test('a ghost keeps the name it was created with', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const ghost = await createMonsterAt('ghost', 11, 10, 0);
    const creationName = ghost.mgivenname;
    await nameMonsterAt(t, 'Casper');

    assert.match(game._pending_message ?? '', /^.+'(?:s)? ghost will not accept the name Casper\.$/);
    assert.equal(ghost.mgivenname, creationName);
});

void test('blank input silently erases an ordinary monster name', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const wolf = await createMonsterAt('wolf', 11, 10, 0);
    setMonsterGivenName(wolf, 'Fang');
    await nameMonsterAt(t, ' ');

    assert.equal(game._pending_message, '');
    assert.equal(wolf.mgivenname, undefined);
    assert.equal(game.context.move, 0);
});

// C do_name.c:x_monnam(): a named player monster carries its adjectives
// after its own " the ", while l_monnam keeps the species with "called".
void test('a named player monster places adjectives after its own the', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    game.u.seeInvisibleTurns = 100;
    const wizard = await createMonsterAt('wizard', 11, 10, 0);
    setMonsterGivenName(wizard, 'Gandalf the Grey');
    wizard.minvis = true;

    assert.equal(monsterName(wizard), 'Gandalf the invisible Grey');
    assert.equal(monsterLeashName(wizard), 'invisible wizard called Gandalf the Grey');
});

// C do_name.c:namefloorobj(): a hallucinating hero is teased with one of
// the six bogus caller names, using the display stream for the choice and
// the core stream for roguename().
void test('hallucinated floor naming announces a bogus caller name', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true }, hero: { hallucinationTurns: 100 } });
    await floorObject(RIN_PROTECTION, 10, 10, { typeKnown: false });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#f');
    planInput(input, t, [
        { prompt: /instructions/, keys: '.' },
    ]);

    await rhack('#'.charCodeAt(0));

    assert.match(game._pending_message ?? '',
        /^The .*ring decides to call you "[^"]+\."$/);
});
