import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, Upolyd } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resolveHeroEngulf } from '../js/hero_engulf.js';
import { resetInputState } from '../js/input.js';
import { AD_DGST, AD_ELEC, AD_WRAP } from '../js/monster_attack_types.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { RIN_SLOW_DIGESTION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
function recordMessages(messages) {
    const input = resetInputState();
    let replies = 0;
    installPagerInput(input, { expected: /swallow|engulf|digest|regurgitat|taste|electric|unhurt|feel better|flesh golem|turn into|amulet|folds itself|lethargic/i, limit: 120 });
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        if (++replies > 100)
            throw new Error(`Unexpected input: ${game._pending_message}`);
    };
    return input;
}
async function captureHero(species, messages, seed = 2n) {
    freshTurnRoom({ role: 'barbarian' });
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 500;
    const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.movement = 12;
    const input = recordMessages(messages);
    initRng(seed);
    input.feed('m.');
    await moveloop_core();
    if (!game.u.uswallow)
        await finishAtCommandInput(input, moveloop_core, /trapper|worm|swallow|engulf|digest|lethargic|folds|feel|squashed/i);
    await flushPendingTopline();
    assert.equal(game.u.ustuck, monster, messages.join('\n'));
    assert.equal(game.u.uswallow, 1);
    return monster;
}
async function becomeFleshGolem(messages) {
    game.flags.debug = true;
    await runExtendedCommand('polyself', 'flesh golem\n');
    await flushPendingTopline();
    assert.ok(game.u.umonnum !== undefined);
    assert.equal(MONSTER_NAME[game.u.umonnum], 'flesh golem');
    recordMessages(messages);
}
void test('a wrapping engulf can deal one damage against negative armor class', async () => {
    const messages = [];
    const trapper = await captureHero('trapper', messages);
    requireFixtureGame(game);
    game.u.uac = -1;
    game.u.uswldtim = 2;
    const hp = game.u.uhp;
    await resolveHeroEngulf(trapper, AD_WRAP, 1);
    assert.equal(game.u.uhp, hp - 1);
    assert.equal(game.u.uswldtim, 1);
    assert.equal(game.u.ustuck, trapper);
});
void test('total digestion uses base HP even when the polymorphed body has more HP', async () => {
    const messages = [];
    const worm = await captureHero('purple worm', messages);
    requireFixtureGame(game);
    await becomeFleshGolem(messages);
    game.u.uhp = 10;
    game.u.uac = 0;
    game.u.uswldtim = 1;
    const hp = game.u.mh;
    assert.ok(hp > game.u.uhp);
    await resolveHeroEngulf(worm, AD_DGST, 1);
    await flushPendingTopline();
    assert.equal(Upolyd(game.u), true);
    assert.equal(game.u.mh, hp - 10);
    assert.equal(game.u.uhp, 10);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.match(messages.join('\n'), /totally digests you![\s\S]*regurgitated/);
});
void test('a slow digestion ring causes regurgitation without digestion damage', async () => {
    const messages = [];
    const worm = await captureHero('purple worm', messages);
    requireFixtureGame(game);
    const ring = await addInventoryObject(RIN_SLOW_DIGESTION);
    await wearHeroAccessory(ring, 'uleft');
    game.u.uac = 0;
    game.u.uswldtim = 4;
    const hp = game.u.uhp;
    messages.length = 0;
    await resolveHeroEngulf(worm, AD_DGST, 1);
    await flushPendingTopline();
    assert.equal(game.u.uhp, hp);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.match(messages.join('\n'), /regurgitated![\s\S]*doesn't like your taste/);
});
void test('electric engulf heals an injured flesh golem instead of damaging it', async () => {
    const messages = [];
    const vortex = await captureHero('energy vortex', messages, 1n);
    requireFixtureGame(game);
    await becomeFleshGolem(messages);
    game.u.mh = game.u.mhmax - 5;
    game.u.uswldtim = 3;
    const hp = game.u.mh;
    messages.length = 0;
    initRng(1n);
    await resolveHeroEngulf(vortex, AD_ELEC, 6);
    await flushPendingTopline();
    assert.equal(game.u.mh, hp + 1);
    assert.equal(game.u.uswldtim, 2);
    assert.equal(game.u.ustuck, vortex);
    assert.match(messages.join('\n'), /crackles with electricity[\s\S]*You seem unhurt[\s\S]*feel better/);
});
//# sourceMappingURL=engulf_effects.test.js.map