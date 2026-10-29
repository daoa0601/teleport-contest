import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
// C wizcmds.c:wiz_show_nhuuid(): the recorder build defines no NHUUID, so
// svn.nhuuid stays empty and the native line names an empty identifier.
void test('#wizshownhuuid reports an empty NHUUID', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    await runExtendedCommand('wizshownhuuid');
    const log = [...game._messageHistory, game._toplines, game._pending_message].join('\n');
    assert.match(log, /The NHUUID for this game is \{  \}\./);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizshownhuuid.test.js.map