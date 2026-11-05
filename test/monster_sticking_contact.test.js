import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { wearHeroArmor } from '../js/do_wear.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
// C uhitm.c:mhitm_ad_stck() mhitu branch: hitmsg() comes first, then a
// non-negated sticky contact holds the hero, and only a barbed devil adds
// "The barbs stick to you!". Magic cancellation suppresses the grip without
// suppressing the hit line.
void test("a barbed devil's sticky claw holds the hero and announces its barbs", async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const devil = await createMonsterAt('barbed devil', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    devil.msleeping = 0;
    devil.mux = game.u.ux;
    devil.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    installPagerInput(input, { expected: /barbed devil|barbs|hits|touches/, limit: 12 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(devil, game, {
        random: limit => 0, rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();
    assert.equal(game.u.ustuck, devil, 'the sticky claw leaves the hero held');
    assert.match(messages.join('\n'), /The barbs stick to you!/);
    assert.ok(game.u.uhp < 100, 'hitmu() still applies the declared contact damage');
});
void test('magic cancellation stops the sticky grip after its hit line', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    const cloak = await addInventoryObject(CLOAK_OF_PROTECTION);
    await wearHeroArmor(cloak);
    requirePlayingGame(game);
    const lichen = await createMonsterAt('lichen', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    lichen.msleeping = 0;
    lichen.mux = game.u.ux;
    lichen.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    installPagerInput(input, { expected: /lichen|touches|escape/, limit: 12 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(lichen, game, {
        random: limit => 0, rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();
    assert.ok(!game.u.ustuck, 'the cancelled sticky contact cannot hold the hero');
    assert.doesNotMatch(messages.join('\n'), /barbs/);
    assert.match(messages.join('\n'), /lichen touches you!/, 'hitmsg() still projects the hit');
});
void test('a lichen touch holds the hero without barbs prose', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const lichen = await createMonsterAt('lichen', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    lichen.msleeping = 0;
    lichen.mux = game.u.ux;
    lichen.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    installPagerInput(input, { expected: /lichen|touches/, limit: 12 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(lichen, game, {
        random: limit => 0, rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();
    assert.equal(game.u.ustuck, lichen, 'the lichen adheres to the hero');
    assert.doesNotMatch(messages.join('\n'), /barbs/);
});
//# sourceMappingURL=monster_sticking_contact.test.js.map