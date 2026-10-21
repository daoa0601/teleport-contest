import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeDeaf } from '../js/hero_hearing.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { makeBlinded } from '../js/sight_change.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
for (const species of ['owlbear', 'bugbear', 'giant']) {
    void test(`an unseen ${species} caught in a bear trap ${species === 'giant' ? 'stays silent' : 'roars'}`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(BEAR_TRAP, {
            x: 15,
            monster: { species, hitPoints: 100 },
        });
        requirePlayingGame(game);
        await makeBlinded(20, { talk: false });
        const messages = [];
        const action = await triggerImmediateMonsterTrap(monster, game, { force: true });
        await finishImmediateMonsterTrap(action, game, { publish: message => { messages.push(message); } });
        assert.equal(monster.mtrapped, 1);
        assert.ok(monster.mhp < 100);
        assert.equal(trap.tseen, false, 'hearing the victim does not reveal the trap');
        assert.equal(messages.join('\n'), species === 'giant' ? '' : 'You hear the roaring of an angry bear!');
    });
}
for (const sleeping of [false, true]) {
    void test(`a deaf ${sleeping ? 'sleeping' : 'awake'} hero ${sleeping ? 'dreams of' : 'cannot hear'} a trapped bear`, async () => {
        const { monster } = await freshMonsterTrapRoom(BEAR_TRAP, {
            x: 15,
            monster: { species: 'owlbear', hitPoints: 100 },
        });
        requirePlayingGame(game);
        await makeBlinded(20, { talk: false });
        await makeDeaf(20, { talk: false });
        if (sleeping)
            await putHeroToSleep(10);
        const messages = [];
        const action = await triggerImmediateMonsterTrap(monster, game, { force: true });
        await finishImmediateMonsterTrap(action, game, { publish: message => { messages.push(message); } });
        assert.equal(messages.join('\n'), sleeping ? 'You dream that you hear the roaring of an angry bear!' : '');
    });
}
//# sourceMappingURL=bear_trap_sound.test.js.map