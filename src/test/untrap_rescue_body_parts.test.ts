import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C trap.c help_monster_out(): the hero reaches out with
// makeplural(body_part(ARM)), so a polymorphed spider uses its pedipalps.
void test('a spider hero helping a monster out of a pit names its own limbs', async () => {
    const level = freshObjectRoom({ role: 'ranger' });
    requirePlayingGame(game);
    installPolymorphedHero('giant spider');
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mtrapped = 1;
    jackal.mpeaceful = 1;
    addTrap(level, PIT, 11, 10, { tseen: true });
    const messages: string[] = [];
    const input = resetInputState();
    input.feed('untrap\nl');
    input.beforeRead = () => { messages.push(game._pending_message || ''); input.feed(' '); };

    await rhack('#'.charCodeAt(0));
    messages.push(game._pending_message || '');

    const reach = messages.find(message => /^You (try to )?reach out your /.test(message));
    assert.ok(reach, `rescue attempt reported: ${JSON.stringify(messages)}`);
    assert.match(reach, /^You (try to )?reach out your pedipalps/);
});
