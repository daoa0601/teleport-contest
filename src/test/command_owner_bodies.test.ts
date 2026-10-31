import test from 'node:test';
import assert from 'node:assert/strict';

// The apply.c/do_name.c/lock.c/sounds.c/pray.c/pickup.c/invent.c/dungeon.c
// command bodies moved out of cmd.ts into their C owners; these tests drive
// the moved mechanics through the command pipeline the game itself uses.
import { HWALL } from '../js/const.js';
import { BRASS_LANTERN } from '../js/object_data.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { dojump, dorub } from '../js/apply.js';
import { dungeonOverviewDisclosure } from '../js/dungeon.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { freshObjectRoom } from './support/object-room.js';

function messageLog(): string {
    return [...game._messageHistory, game._toplines, game._pending_message].join('\n');
}

// C apply.c:dojump(): without jumping magic the physical jump refuses.
void test('dojump: an ordinary hero cannot jump very far', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    requirePlayingGame(game);
    initRng(11n);

    await dojump();

    assert.match(messageLog(), /You can't jump very far\./);
    assert.equal(game.context.move, 0);
});

// C apply.c:dorub(): rubbing the electric lantern wastes its batteries.
void test('dorub: a wielded brass lantern only disappoints', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    requirePlayingGame(game);
    const lantern = await addInventoryObject(BRASS_LANTERN);
    resetInputState().display = { async readKey() { return 32; } };
    game.uwep = lantern;
    initRng(12n);

    await dorub(lantern.invlet);

    assert.match(messageLog(), /Rubbing the electric lamp is not particularly rewarding\./);
    assert.match(messageLog(), /Anyway, nothing exciting happens\./);
    assert.equal(game.context.move, 1);
});

// C do_name.c:docallcmd(): the 'a' category names the level through
// dungeon.c:query_annotation(), and the final overview discloses the name.
void test('doname: the level annotation reaches the overview disclosure', async () => {
    freshConnectedLevels();
    const input = resetInputState();
    input.feed('name\raShrine\r');

    await rhack('#'.charCodeAt(0));

    assert.equal(game._levelAnnotations?.get('0:1'), 'Shrine');
    assert.equal(game.context.move, 0);
    const disclosure = dungeonOverviewDisclosure('quit', 'quit');
    assert.ok(disclosure.some(line =>
        (typeof line === 'string' ? line : line.text).includes('"Shrine"')),
    'the final overview must quote the annotation');
});

// C pray.c:doturn(): a valkyrie without the turn undead spell only gets the
// refusal, and the command spends no turn.
void test('doturn: unknowing heroes are told they cannot turn undead', async () => {
    await freshObjectRoom({ role: 'valkyrie' });

    await runExtendedCommand('turn');

    assert.match(messageLog(), /You don't know how to turn undead!/);
    assert.equal(game.context.move, 0);
});

// C sounds.c:dochat(): talking at solid rock answers in kind.
void test('dochat: talking to a wall is like talking to a wall', async () => {
    const level = await freshObjectRoom({ role: 'valkyrie' });
    level.requireAt(11, 10).typ = HWALL;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, "It's like talking to a wall.");
    assert.equal(game.context.move, 0);
});
