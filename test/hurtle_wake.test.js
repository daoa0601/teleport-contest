import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, STONE, STRAT_WAITMASK } from '../js/const.js';
import { canSeeMonster, flushPendingTopline, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
void test('a hurtled hero wakes visible sleeping neighbours after bumping a sleeper', async () => {
    freshObjectRoom();
    const flags = MM_ANGRY | MM_NOGRP | NO_MINVENT;
    const bumped = await createMonsterAt('leprechaun', 11, 10, flags);
    const goblin = await createMonsterAt('goblin', 12, 10, flags);
    const newt = await createMonsterAt('newt', 12, 11, flags);
    const unseen = await createMonsterAt('kobold', 13, 10, flags);
    const outside = await createMonsterAt('fox', 14, 11, flags);
    for (const monster of [bumped, goblin, newt, unseen, outside])
        monster.msleeping = 1;
    goblin.mstrategy = STRAT_WAITMASK;
    unseen.minvis = 1;
    assert.equal(canSeeMonster(unseen), false);
    for (const monster of [bumped, goblin, newt]) {
        assert.equal(canSeeMonster(monster), true);
        newsym(monster.mx, monster.my);
    }
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /bump into|wakes up/, limit: 4 });
    await hurtleHero(1, 0, 2);
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /You bump into a leprechaun\..*The leprechaun wakes up\./s);
    for (const monster of [bumped, goblin, newt, unseen])
        assert.equal(monster.msleeping, 0);
    for (const name of ['goblin', 'newt']) {
        assert.match(text, new RegExp(`The leprechaun wakes up\\.[\\s\\S]*The ${name} wakes up\\.`));
    }
    assert.equal(goblin.mstrategy & STRAT_WAITMASK, 0);
    assert.doesNotMatch(text, /kobold wakes up/);
    assert.equal(outside.msleeping, 1, 'distance 10 lies outside the strictly nearer wake radius');
    assert.equal(game.u.ux, 10, 'the collision stops the hero before the occupied square');
});
for (const obstacle of ['wall', 'cockatrice']) {
    void test(`a fatal hurtle into a ${obstacle} ends before waking nearby sleepers`, async () => {
        const level = freshObjectRoom({
            hero: { uhp: 1, uhpmax: 40 },
            flags: { bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
        });
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
        const flags = MM_ANGRY | MM_NOGRP | NO_MINVENT;
        const sleeper = await createMonsterAt('goblin', 10, 11, flags);
        sleeper.msleeping = 1;
        if (obstacle === 'wall')
            level.requireAt(11, 10).typ = STONE;
        else
            await createMonsterAt('cockatrice', 11, 10, flags);
        const input = resetInputState();
        installPagerInput(input, { expected: /Ouch|bump|stone|die|points|Goodbye|You were/i, limit: 10 });
        await hurtleHero(1, 0, 2);
        assert.equal(game.program_state.gameover, true);
        assert.equal(sleeper.msleeping, 1, 'native death does not return to the wake call');
    });
}
//# sourceMappingURL=hurtle_wake.test.js.map