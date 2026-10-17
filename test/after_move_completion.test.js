import assert from 'node:assert/strict';
import test from 'node:test';
import { finishHeroHelplessness, moveloop_core } from '../js/allmain.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { nomul, setMulti } from '../js/command_state.js';
import { M_AP_NOTHING, M_AP_OBJECT, NO_MINVENT, POOL } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resolveHeroCombatEngulf } from '../js/hero_combat_engulf.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { beginMealMimicry } from '../js/meal_mimic.js';
import { AD_DGST, AT_ENGL } from '../js/monster_attack_types.js';
import { SPEED_BOOTS } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('water waking a sleeping hero completes the pending boots dressing', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const boots = await addInventoryObject(SPEED_BOOTS, { known: false });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 20 });
    input.feed(`${boots.invlet}`);
    await rhack('W'.charCodeAt(0));
    putHeroToSleep(8);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const result = await heroLiquidEffects();
    assert.equal(result?.moved, true, 'The awakened hero crawls onto dry ground');
    assert.equal(game.uarmf, boots);
    assert.equal(boots.known, true, 'The water wakeup finishes Boots_on');
    assert.equal(game.u.veryFast, true);
    assert.match([...messages, game._pending_message].join('\n'), /Suddenly you wake up![\s\S]*You feel yourself speed up/);
});
void test('mimic recovery after a water wakeup cannot finish an old boots removal', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const boots = await addInventoryObject(SPEED_BOOTS);
    wearHeroArmor(boots);
    await applyArmorOnEffects(boots);
    let messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 30 });
    await rhack('T'.charCodeAt(0));
    putHeroToSleep(8);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    await heroLiquidEffects();
    await flushPendingTopline();
    messages = [];
    await beginMealMimicry(20);
    await finishHeroHelplessness();
    input.feed('\x1b');
    await moveloop_core();
    assert.equal(game.u.m_ap_type, M_AP_NOTHING);
    assert.equal(boots.worn, false);
    assert.equal(game.uarmf, null);
    const feedback = [...messages, game._pending_message].join('\n');
    assert.match(feedback, /You now prefer mimicking a human again\./);
    assert.doesNotMatch(feedback, /slow down|taking off|dressing maneuver/, 'Mimic recovery must not run a second armor completion');
});
for (const command of ['W', 'T']) {
    void test(`mimicking replaces an unfinished ${command === 'W' ? 'dressing' : 'removal'} completion`, async () => {
        const input = freshTurnRoom();
        const boots = await addInventoryObject(SPEED_BOOTS, { known: false });
        if (command === 'T') {
            wearHeroArmor(boots);
            await applyArmorOnEffects(boots);
        }
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /./, limit: 30 });
        if (command === 'W')
            input.feed(`${boots.invlet}`);
        await rhack(command.charCodeAt(0));
        await beginMealMimicry(20);
        input.feed('\x1b');
        for (let turn = 0; turn < 50 && game.u.m_ap_type !== M_AP_NOTHING; turn++)
            await moveloop_core();
        assert.equal(game.u.m_ap_type, M_AP_NOTHING, 'Mimicry ends at its normal recovery');
        assert.equal(game.uarmf, boots, 'The replaced removal cannot take the boots off');
        assert.equal(boots.known, false, 'The replaced dressing cannot identify the boots');
        const feedback = [...messages, game._pending_message].join('\n');
        assert.match(feedback, /You now prefer mimicking a human again\./);
        assert.doesNotMatch(feedback, /speed up|slow down|taking off|dressing maneuver/);
    });
}
void test('nomul zero leaves a pending dressing completion for a later unmul', async () => {
    const input = freshTurnRoom();
    const boots = await addInventoryObject(SPEED_BOOTS, { known: false });
    installPagerInput(input, { expected: /./, limit: 10 });
    input.feed(`${boots.invlet}`);
    await rhack('W'.charCodeAt(0));
    // Combat and relocation can assign multi directly; nomul(0) itself
    // neither runs nor discards the still-pending Armor_on callback.
    setMulti(0);
    nomul(0);
    assert.equal(boots.known, false);
    await finishHeroHelplessness('');
    assert.equal(boots.known, true);
    assert.equal(game.uarmf, boots);
});
void test('finishing digestion can start mimicry whose recovery still runs', async () => {
    const input = freshTurnRoom();
    installPolymorphedHero('purple worm');
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    installPagerInput(input, { expected: /./, limit: 20 });
    await resolveHeroCombatEngulf(mimic, [AT_ENGL, AD_DGST, 1, 6], { random: () => 0 });
    assert.equal(game.u.m_ap_type ?? M_AP_NOTHING, M_AP_NOTHING);
    await finishHeroHelplessness();
    assert.equal(game.u.m_ap_type, M_AP_OBJECT, 'Digesting a mimic starts a new delay');
    assert.ok(game.multi < 0);
    await finishHeroHelplessness();
    assert.equal(game.u.m_ap_type, M_AP_NOTHING, 'The new callback survives the previous completion');
});
void test('survival recovery reminds a polymorphed hero of their current form', async () => {
    const input = freshTurnRoom();
    installPolymorphedHero('purple worm');
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 5 });
    await finishHeroHelplessness('You survived that attempt on your life.');
    assert.match([...messages, game._pending_message].join('\n'), /You survived that attempt on your life\.[\s\S]*You are a purple worm\./);
});
//# sourceMappingURL=after_move_completion.test.js.map