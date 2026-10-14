import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObjects } from './support/level-state.js';
void test('upward Grimtooth venom can hit the ceiling or fall back and blind its owner', async () => {
    let hitCeiling = false;
    let blindedOwner = false;
    for (let seed = 1; seed <= 48; seed++) {
        const level = freshObjectRoom({
            hero: { ualign: { type: -1, record: 10 } }, gameplaySeed: seed,
        });
        requirePlayingGame(game);
        const dagger = await artifactObject('Grimtooth', { invlet: 'a', where: 'inventory', age: 0 });
        game.inventory = [dagger];
        const messages = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };
        await invokeInventoryObject(dagger, '<' + ' '.repeat(20));
        messages.push(game._pending_message);
        const feedback = messages.join('\n');
        const blindTurns = game.u.blindTurns ?? 0;
        hitCeiling ||= /A splash of venom hits the ceiling\./.test(feedback);
        if (blindTurns > 0) {
            blindedOwner = true;
            assert.match(feedback, /(?:almost )?hits the ceiling, then falls back on top of your head/);
            assert.match(feedback, /You've got it all over your face!/);
            assert.match(feedback, /It blinds you!/);
            assert.ok(blindTurns <= 25);
            assert.equal(game.u.ucreamed, blindTurns);
            assert.equal(floorObjects(level).length, 0);
        }
        assert.equal(game.u.uhp, 40);
        assert.equal(game.inventory.includes(dagger), true);
        assert.equal(game.context.move, 1);
        assert.ok(dagger.age > game.moves);
    }
    assert.equal(hitCeiling, true, 'An upward toss must be able to hit the ceiling');
    assert.equal(blindedOwner, true, 'Falling blinding venom must be able to blind its owner');
});
void test('Grimtooth flings hero-owned venom without removing the dagger', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 10 },
            acurr: { a: [12, 12, 12, 25, 12, 12] }, amax: { a: [12, 12, 12, 25, 12, 12] } },
        gameplaySeed: 17n });
    requirePlayingGame(game);
    const dagger = await artifactObject('Grimtooth', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [dagger];
    const target = await createMonsterAt('gnome', game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | MM_NOMSG | NO_MINVENT);
    target.mhp = target.mhpmax = 50;
    await invokeInventoryObject(dagger, 'l' + ' '.repeat(20));
    assert.ok(target.mcansee === 0 || target.mhp < 50);
    assert.equal(game.inventory.includes(dagger), true);
    assert.ok(dagger.age > game.moves);
    assert.equal(game.context.move, 1);
});
void test('cancelling Grimtooth poison releases its cooldown and takes no time', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 10 } } });
    requirePlayingGame(game);
    const dagger = await artifactObject('Grimtooth', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [dagger];
    await invokeInventoryObject(dagger, '\u001b');
    assert.equal(dagger.age, game.moves);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'Never mind.');
});
//# sourceMappingURL=artifact_invoke_poison.test.js.map