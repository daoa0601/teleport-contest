import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE, PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { CORPSE, SADDLE } from '../js/object_data.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function collectMessages() {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || game._last_message || '');
        input.feed(' ');
    };
    return messages;
}
function findFloorObjects(otyp, pred) {
    const found = [];
    for (const [x, column] of (game.level?.objects ?? []).entries()) {
        if (!column)
            continue;
        for (const [y, pile] of column.entries()) {
            for (const object of pile || []) {
                if (object.otyp === otyp && (!pred || pred(object)))
                    found.push({ object, x, y });
            }
        }
    }
    return found;
}
// C trap.c:trapeffect_landmine() grounded branch calls steedintrap(), whose
// LANDMINE case thitm()s the ridden steed for rnd(16); after the blast,
// keep_saddle_with_steedcorpse() moves the saddle onto the steed's corpse.
void test('a ridden steed takes the land mine blast and the saddle follows its corpse', async () => {
    let verified = false;
    for (let seed = 1n; seed <= 80n && !verified; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        const steed = await createSaddledSteed();
        steed.mhp = 1; // any rnd(16) roll kills the steed
        game.u.usteed = steed;
        game.u.uhp = game.u.uhpmax = 200;
        const trap = addTrap(game.level, LANDMINE, game.u.ux, game.u.uy);
        const messages = collectMessages();
        initRng(seed);
        await triggerHeroTrap(trap);
        messages.push(game._pending_message || game._last_message || '');
        if (!(steed.mhp <= 0))
            continue;
        assert.equal(game.u.usteed, null, 'the dying steed dismounts the hero');
        assert.equal(trap.ttyp, PIT, 'the mine becomes a pit');
        assert.ok(game.u.uhp < 200, 'the hero still takes the blast');
        const saddles = findFloorObjects(SADDLE);
        const corpses = findFloorObjects(CORPSE, object => object.oextra?.omonst?.m_id === steed.m_id);
        const saddle = saddles[0];
        const corpse = corpses[0];
        if (!saddle || !corpse)
            continue; // the blast destroyed one
        verified = true;
        assert.deepEqual([saddle.x, saddle.y], [corpse.x, corpse.y], 'the saddle stays with the steed corpse');
    }
    assert.equal(verified, true, 'some seed must exercise the steed hit');
});
// C trap.c:2548-2562: a flying hero sitting on their own known mine reads
// "There is the trigger of your mine..." and "The air currents set your land
// mine off!" (a_your[madeby_u] variant), not the generic "a trigger" text.
void test('a flying hero sitting on their own known mine gets the madeby_u trigger messages', async () => {
    let seen = false;
    for (let seed = 1n; seed <= 80n && !seen; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        grantIntrinsicProperty('flying', 'outside');
        game.u.uhp = game.u.uhpmax = 200;
        const trap = addTrap(game.level, LANDMINE, game.u.ux, game.u.uy, { tseen: true, madeby_u: true });
        const messages = collectMessages();
        initRng(seed);
        await triggerHeroTrap(trap, { viaSitting: true });
        messages.push(game._pending_message || game._last_message || '');
        const text = messages.join(' ');
        // The seen mine only detonates when its second rn2(3) roll is zero.
        if (!text.includes('trigger of your mine')
            || !text.includes('air currents set'))
            continue;
        seen = true;
        assert.match(text, /There is the trigger of your mine in a pile of soil below you\./);
        assert.match(text, /KAABLAMM!!!  The air currents set your land mine off!/);
    }
    assert.equal(seen, true, 'some seed must detonate the seen own mine');
});
// C trap.c:2553: an unseen mine reports "You discover ... a trigger"; with
// madeby_u the trigger is "the trigger of your mine", and the unseen blast
// message is "The air currents set it off!".
void test('a flying hero discovering their own unseen mine gets the discovery variants', async () => {
    let seen = false;
    for (let seed = 1n; seed <= 80n && !seen; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        grantIntrinsicProperty('flying', 'outside');
        game.u.uhp = game.u.uhpmax = 200;
        const trap = addTrap(game.level, LANDMINE, game.u.ux, game.u.uy, { madeby_u: true });
        const messages = collectMessages();
        initRng(seed);
        await triggerHeroTrap(trap, { viaSitting: true });
        messages.push(game._pending_message || game._last_message || '');
        const text = messages.join(' ');
        if (!text.includes('You discover'))
            continue;
        seen = true;
        assert.match(text, /You discover the trigger of your mine in a pile of soil below you\./);
        assert.match(text, /KAABLAMM!!!  The air currents set it off!/);
    }
    assert.equal(seen, true, 'some seed must discover the unseen own mine');
});
//# sourceMappingURL=landmine_steed_trap.test.js.map