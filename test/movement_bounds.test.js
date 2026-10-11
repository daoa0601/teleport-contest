import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [x, y, key, direction] of [
    [1, 10, 'h', 'west'], [79, 10, 'l', 'east'],
    [10, 0, 'k', 'north'], [10, 20, 'j', 'south'],
    [1, 0, 'y', 'northwest'], [79, 0, 'u', 'northeast'],
    [1, 20, 'b', 'southwest'], [79, 20, 'n', 'southeast'],
    [1, 10, 'y', 'west'], [79, 10, 'n', 'east'],
    [10, 0, 'u', 'north'], [10, 20, 'b', 'south'],
]) {
    void test(`walking ${key} from ${x},${y} reports the ${direction} map limit`, async () => {
        freshObjectRoom({
            left: 1, right: 79, top: 0, bottom: 20,
            heroX: x, heroY: y, flags: { mention_walls: true },
        });
        requirePlayingGame(game);
        const moves = game.moves;
        await rhack(key.charCodeAt(0));
        assert.deepEqual([game.u.ux, game.u.uy], [x, y]);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, moves);
        assert.equal(game._pending_message, `You have already gone as far ${direction} as possible.`);
    });
}
for (const [mode, keys] of [
    ['counted walk', '4k'], ['run', 'K'], ['rush', '\x0b'],
]) {
    void test(`a ${mode} stops at the map edge without spending a turn`, async () => {
        freshObjectRoom({
            left: 1, right: 79, top: 0, bottom: 20,
            heroX: 10, heroY: 0, flags: { mention_walls: false },
        });
        requirePlayingGame(game);
        pushKeys(keys);
        await rhack(0);
        assert.deepEqual([game.u.ux, game.u.uy], [10, 0]);
        assert.equal(game.context.move, 0);
        assert.equal(game.multi, 0);
        assert.equal(game.context.run, 0);
        assert.equal(game.context.mv, false);
        assert.equal(game._runState, null);
        assert.equal(game._pending_message, '');
    });
}
for (const [x, y, key] of [[1, 10, 'h'], [10, 0, 'k']]) {
    void test(`force fighting beyond ${x},${y} attacks an unknown obstacle`, async () => {
        freshObjectRoom({
            left: 1, right: 79, top: 0, bottom: 20,
            heroX: x, heroY: y, flags: { mention_walls: true },
        });
        requirePlayingGame(game);
        pushKeys(`F${key}`);
        await rhack(0);
        assert.deepEqual([game.u.ux, game.u.uy], [x, y]);
        assert.equal(game.context.move, 1);
        assert.equal(game.context.forcefight, false);
        assert.equal(game.multi, 0);
        assert.equal(game._pending_message, 'You harmlessly attack an unknown obstacle.');
    });
}
for (const [x, y, key, destination] of [
    [2, 1, 'y', [1, 0]], [78, 19, 'n', [79, 20]],
]) {
    void test(`the hero can enter the legal map corner ${destination}`, async () => {
        freshObjectRoom({
            left: 1, right: 79, top: 0, bottom: 20,
            heroX: x, heroY: y,
        });
        requirePlayingGame(game);
        await rhack(key.charCodeAt(0));
        assert.deepEqual([game.u.ux, game.u.uy], destination);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=movement_bounds.test.js.map