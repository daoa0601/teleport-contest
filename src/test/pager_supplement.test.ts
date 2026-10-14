import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('ordinary look offers the history behind a named orc horde', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false, help: true } });
    const orc = await createMonsterAt('hill orc', 11, 10);
    setMonsterGivenName(orc, 'Zogg of Gruz');
    newsym(11, 10);
    const input = resetInputState();
    input.feed('/l.');
    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /hill orc called Zogg of Gruz[\s\S]*--More--/, keys: ' ' },
        { prompt: /More info about "hill orc"\?/, keys: 'n' },
        { prompt: /More info about "Zogg of Gruz"\?/, keys: 'y' },
        { prompt: /marauding horde of orcs[\s\S]*leader Gruz[\s\S]*--More--/, keys: ' ' },
        { prompt: /Pick a monster, object or location\./, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 0);
});

void test('orc horde history retains conditions from the selected description', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false, help: true } });
    const orc = await createMonsterAt('hill orc', 11, 10);
    setMonsterGivenName(orc, 'Zogg of Gruz');
    orc.msleeping = true;
    newsym(11, 10);
    const input = resetInputState();
    input.feed('/l.');

    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /hill orc called Zogg of Gruz, asleep[\s\S]*--More--/, keys: ' ' },
        { prompt: /More info about "zogg of gruz, asleep"\?/, keys: 'n' },
        { prompt: /More info about "hill orc"\?/, keys: 'n' },
        { prompt: /More info about "Zogg of Gruz, asleep"\?/, keys: 'y' },
        { prompt: /Zogg of Gruz, asleep is a member[\s\S]*leader Gruz, asleep in their names\.[\s\S]*--More--/, keys: ' ' },
        { prompt: /Pick a monster, object or location\./, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 0);
});
