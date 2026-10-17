import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_STR, G_GENOD, M_AP_NOTHING, POLY_CONTROLLED, UNENCUMBERED } from '../js/const.js';
import { heroHasInvoluntaryDelay } from '../js/command_state.js';
import { flushPendingTopline } from '../js/display.js';
import { doGenocide, GENOCIDE_ON_THRONE } from '../js/genocide.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { beginMealMimicry } from '../js/meal_mimic.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, ROCK, WAN_LIGHT } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { minimalObjectName } from '../js/objnam.js';
import { polymonHero, polymorphHero, returnHeroToHumanForm } from '../js/polyself.js';
import { loadScoreRecords } from '../js/score_records.js';
import { heroIsBlind } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
function formTransitionRoom(debug = false) {
    freshObjectRoom({
        gameplaySeed: 143n,
        hero: { urexp: 1000 },
        flags: { debug, bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
    });
    requireFixtureGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20, bonetag: 'D' })];
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const input = resetInputState();
    const seen = [];
    const screen = () => requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    input.beforeRead = () => { seen.push(screen()); };
    installPagerInput(input, {
        expected: /genocide|wiped out|feel (?:dead|empty|condemned)|return to|new (?:man|woman)|amulet|medallion|skin|see again|much better|don't die|Goodbye|points|You were|mimic|no longer|turn into|unchanging/i,
        limit: 30,
    });
    return { input, text: () => [...seen, screen()].join('\n') };
}
async function genocideHumanBase(flags) {
    if (!(flags & 2))
        pushKeys('human\n');
    await doGenocide(flags);
    await flushPendingTopline();
}
for (const scenario of [
    { flags: 1, cause: 'killed by a scroll of genocide' },
    { flags: 3, cause: 'killed by genocidal confusion' },
    { flags: 1 | GENOCIDE_ON_THRONE, cause: 'killed by an imperious order' },
]) {
    void test(`losing a borrowed body preserves ${scenario.cause} before human aftermath`, async () => {
        const { text } = formTransitionRoom();
        requirePlayingGame(game);
        installPolymorphedHero('black pudding');
        const amulet = await addInventoryObject(AMULET_OF_STRANGULATION);
        await wearHeroAccessory(amulet, 'uamul');
        const wand = await addInventoryObject(WAN_LIGHT, { observed: false, dknown: false });
        await flushPendingTopline();
        await genocideHumanBase(scenario.flags);
        assert.equal(game.program_state.gameover ?? false, false);
        assert.ok(game.u.mh > 0);
        assert.equal(heroIsBlind(), true);
        const died = await loseHeroHp(game.u.mh, 'a falling rock');
        assert.equal(died, true);
        assert.equal(game.u.umonnum, game.u.umonster);
        assert.equal(game.u.strangledTurns ?? 0, 0);
        assert.equal(wand.dknown, true, 'Postmortem identification reveals the carried wand');
        const records = loadScoreRecords();
        assert.equal(records[0]?.death, scenario.cause);
        const messages = text();
        assert.match(messages, /You return to human form!/);
        assert.doesNotMatch(messages, /can see again|begins constricting|old form was not healthy/);
    });
}
void test('a genocided original race is fatal even when the restored human HP is positive', async () => {
    formTransitionRoom();
    requireFixtureGame(game);
    installPolymorphedHero('wolf');
    const human = game.mvitals[game.urace.mnum];
    assert.ok(human);
    human.mvflags |= G_GENOD;
    assert.ok(game.u.uhp > 0);
    const result = await returnHeroToHumanForm();
    assert.equal(result.died, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by self-genocide');
});
void test('controlled newman reaches genocide after announcing its renewed human body', async () => {
    const { input, text } = formTransitionRoom();
    requirePlayingGame(game);
    installPolymorphedHero('black pudding');
    await genocideHumanBase(1);
    game.u.polymorphControl = true;
    input.feed('human\n');
    const result = await polymorphHero(POLY_CONTROLLED);
    assert.equal('newman' in result && result.newman, true);
    assert.equal('died' in result && result.died, true);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a scroll of genocide');
    assert.match(text(), /You feel like a new (?:man|woman)!/);
});
void test('refusing delayed genocide resumes sight and strangulation, and consumes the earlier death cause', async () => {
    const { input } = formTransitionRoom(true);
    requirePlayingGame(game);
    installPolymorphedHero('black pudding');
    game.u.macurr = { a: [9, 10, 11, 12, 13, 14] };
    game.u.mamax = { a: [15, 15, 15, 15, 15, 15] };
    game.u.mfemale = true;
    const amulet = await addInventoryObject(AMULET_OF_STRANGULATION);
    await wearHeroAccessory(amulet, 'uamul');
    const wand = await addInventoryObject(WAN_LIGHT, { observed: false, dknown: false });
    await flushPendingTopline();
    await genocideHumanBase(1);
    const pager = input.display;
    assert.ok(pager);
    let refusals = 0;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('Die?')) {
                refusals++;
                assert.equal(wand.dknown, false, 'Sight recovery must wait until the death decision.');
                assert.equal(game.u.strangledTurns ?? 0, 0, 'Strangulation must wait until the death decision.');
                return 'n'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };
    assert.equal((await returnHeroToHumanForm()).died, false);
    await flushPendingTopline();
    assert.equal(refusals, 1);
    assert.equal(game.program_state.gameover ?? false, false);
    assert.equal(heroIsBlind(), false);
    assert.equal(wand.dknown, true);
    assert.equal(game.u.strangledTurns, 6);
    assert.equal(game.u.acurr.a[A_STR], 9);
    assert.equal(game.flags.female, true);
    game.flags.debug = false;
    input.display = pager;
    await polymonHero(MONSTER_NAME.indexOf('black pudding'));
    await flushPendingTopline();
    assert.equal((await returnHeroToHumanForm()).died, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by self-genocide, while attempting to cheat Death');
});
void test('returning to human form ends a mimic meal without its delayed recovery message', async () => {
    const { text } = formTransitionRoom();
    installPolymorphedHero('wolf');
    await beginMealMimicry(20);
    assert.equal(heroHasInvoluntaryDelay(), true);
    const result = await returnHeroToHumanForm();
    await flushPendingTopline();
    assert.equal(result.died, false);
    assert.equal(heroHasInvoluntaryDelay(), false);
    assert.equal(game.u.m_ap_type, M_AP_NOTHING);
    assert.equal(game.u.mappearance, 0);
    assert.match(text(), /You return to human form!/);
    assert.doesNotMatch(text(), /now prefer mimicking|suddenly dread being peeled/);
});
void test('an unchanging amulet is discovered when a living monster body is forced back to human', async () => {
    const { text } = formTransitionRoom();
    const amulet = await addInventoryObject(AMULET_OF_UNCHANGING, { typeKnown: false, known: false });
    await wearHeroAccessory(amulet, 'uamul');
    await flushPendingTopline();
    installPolymorphedHero('wolf');
    const result = await returnHeroToHumanForm();
    await flushPendingTopline();
    assert.equal(result.changed, true);
    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(amulet.dknown, true);
    assert.equal(minimalObjectName(amulet), 'amulet of unchanging');
    assert.match(text(), /Your .*amulet.* fails!/);
});
// C polyself.c:newman(): polyman() announces the renewed body and the later
// encumber_msg() joins that topline instead of replacing it.
void test('a renewed human body keeps its announcement before the encumbrance change', async () => {
    const { input, text } = formTransitionRoom();
    requirePlayingGame(game);
    installPolymorphedHero('homunculus');
    while (nearCapacity(game) === UNENCUMBERED)
        await addInventoryObject(ROCK);
    game._encumbranceLevel = nearCapacity(game);
    await flushPendingTopline();
    game.u.polymorphControl = true;
    input.feed('human\n');
    const result = await polymorphHero(POLY_CONTROLLED);
    assert.equal('newman' in result && result.newman, true);
    assert.equal(nearCapacity(game), UNENCUMBERED);
    assert.match(`${text()}\n${game._pending_message ?? ''}`, /You feel like a new (?:man|woman)!  Your movements are now unencumbered\./);
});
//# sourceMappingURL=human_form_transition.test.js.map