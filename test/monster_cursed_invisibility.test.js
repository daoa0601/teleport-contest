import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsUnconscious, putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { revealAggravatingMonster } from '../js/monster_item_use.js';
import { initializePet } from '../js/dog.js';
import { POT_INVISIBILITY } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an aggravating potion revelation names a tame drinker as your monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const drinker = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
    initializePet(drinker, { state: game });
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.display = {
        async readKey() {
            const row = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
            assert.match(row, /--More--/);
            return 32;
        },
    };
    await revealAggravatingMonster(drinker, game);
    assert.ok(messages.includes("For some reason, your goblin's presence is known to you."), `Expected the pet's presence message; received: ${messages.join(' | ')}`);
    assert.ok(messages.includes('You feel aggravated at your goblin.'), `Expected the pet's aggravation message; received: ${messages.join(' | ')}`);
});
for (const visible of [true, false]) {
    void test(`a cursed invisibility potion reveals its ${visible ? 'visible' : 'unseen'} drinker before the turn resumes`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game._moveloopStarted = true;
        game.u.umovement = 12;
        const drinker = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
        drinker.mpeaceful = 0;
        drinker.msleeping = 0;
        if (!visible)
            setHeroBlindnessTurns(20, game);
        drinker.movement = 12;
        const potion = await addObjectToMonsterInventory(drinker, await knownObject(POT_INVISIBILITY, { cursed: true }), game);
        assert.ok(potion);
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_INVISIBILITY] = 'ruby';
        const input = resetInputState();
        input.feed('.');
        await moveloop_core();
        const pages = [];
        input.display = {
            async readKey() {
                const display = game.nhDisplay;
                assert.ok(display);
                const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                if (game._pending_message && screen.includes('--More--')) {
                    pages.push(screen);
                    assert.equal(drinker.minvent.includes(potion), true, 'm_useup() follows the revelation and its acknowledgment');
                    return 32;
                }
                return 27;
            },
        };
        await moveloop_core();
        assert.ok(pages.some(page => page.startsWith(visible
            ? 'The goblin briefly seems to be transparent.--More--'
            : 'You hear a chugging sound.--More--')), pages.map(page => page.split('\n')[0]).join('\n'));
        const revelation = pages.find(page => page.startsWith('You feel aggravated at the goblin.--More--'));
        assert.ok(revelation, 'the revealed monster must be acknowledged on the temporary map');
        assert.equal(revelation.split('\n')[11]?.[13], 'o');
        assert.equal(revelation.split('\n')[10]?.[13], ' ', 'the revelation clears the ordinary floor');
        assert.equal(drinker.minvis, 0);
        assert.equal(potion.where, 'gone');
    });
}
void test('an aggravating potion revelation wakes a sleeping hero after its acknowledgment', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const drinker = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
    putHeroToSleep(10, { state: game });
    await plineWithContinuation('You dream that you hear a chugging sound.');
    const input = resetInputState();
    let acknowledgedRevelation = false;
    input.display = {
        async readKey() {
            assert.equal(heroIsUnconscious(game), true, 'the hero remains asleep during the revelation pagers');
            const screen = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
            assert.match(screen, /--More--/);
            if (screen.startsWith('You dream that you feel aggravated at the goblin.'))
                acknowledgedRevelation = true;
            return 32;
        },
    };
    await revealAggravatingMonster(drinker, game);
    assert.equal(acknowledgedRevelation, true);
    assert.equal(game._helplessTurns, 1);
    assert.equal(game._helplessDoneMessage, 'Aggravated, you are jolted into full consciousness.');
});
//# sourceMappingURL=monster_cursed_invisibility.test.js.map