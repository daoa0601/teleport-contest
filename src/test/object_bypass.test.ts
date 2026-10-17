import { clearBypasses } from '../js/object_bypass.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame, resetGame } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { MENU_COMBINATION, MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL } from '../js/const.js';
import { hitFloorPileWithWand } from '../js/immediate_zap.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { CLUB, DAGGER, POT_WATER, ROCK, STATUE, WAN_CANCELLATION, WAN_STRIKING } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { breakWand } from '../js/wand_break.js';
import { destroyInventoryByElement, destroyFireMonsterInventory } from '../js/zap.js';
import { addInventoryObject, chargedWand } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { resetInputState } from '../js/input.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';

for (const damageType of ['fire', undefined] as const) {
    void test(`${damageType ?? 'magical blast'} inventory traversal protects a slain stone golem from a broken striking wand`, async () => {
        freshObjectRoom({ gameplaySeed: 19, hero: { uhp: 500, uhpmax: 500 } });
        requirePlayingGame(game);
        const input = resetInputState();
        installPagerInput(input, { limit: 100, expected: /wand|force|golem|kill|blast|caught|rock|shatter|damage|destroy/i });
        const wand = await addInventoryObject(WAN_STRIKING, { spe: 3 });
        await addInventoryObject(DAGGER);
        const golem = await createMonsterAt('stone golem', 11, 10);
        golem.mhp = 1;
        await destroyInventoryByElement(damageType, 10);
        input.feed('y');

        await breakWand(wand);

        assert.ok(golem.dead || golem.mhp <= 0, 'the broken wand killed the golem');
        const remains = floorObjectsAt(game.level, 11, 10);
        assert.ok(remains.some(object => object.otyp === STATUE), 'the new statue survives the same striking blast');
        assert.equal(remains.some(object => object.otyp === ROCK), false);
    });
}

void test('a counted menu drop leaves the rest of its stack in inventory', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    requirePlayingGame(game);
    const daggers = await addInventoryObject(DAGGER, { quan: 5 });
    resetInputState().feed(`2${daggers.invlet}\n`);

    await rhack('D'.charCodeAt(0));

    assert.equal(daggers.quan, 3);
    assert.equal(daggers.where, 'inventory');
    const dropped = floorObjectsAt(game.level, game.u.ux, game.u.uy).find(object => object.otyp === DAGGER);
    assert.equal(dropped?.quan, 2);
});

void test('combination-style multi-drop applies the requested object class', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_COMBINATION, verbose: false } });
    const dagger = await addInventoryObject(DAGGER);
    const potion = await addInventoryObject(POT_WATER);
    resetInputState().feed(`)\n${dagger.invlet}\n`);

    await rhack('D'.charCodeAt(0));

    assert.equal(dagger.where, 'floor');
    assert.equal(potion.where, 'inventory');
});

void test('monster inventory damage protects new remains only until turn cleanup', async () => {
    freshObjectRoom({ gameplaySeed: 23 });
    requirePlayingGame(game);
    const input = resetInputState();
    installPagerInput(input, { limit: 100, expected: /golem|kill|statue|shatter/i });
    const carrier = await createMonsterAt('hobbit', 12, 10);
    const golem = await createMonsterAt('stone golem', 11, 10);
    await destroyFireMonsterInventory(carrier, 10);
    await finishHeroMonsterKill(golem, 11, 10, { showKillMessage: false });
    const wand = await chargedWand(WAN_STRIKING);

    await hitFloorPileWithWand(wand, 11, 10);
    assert.ok(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === STATUE));

    clearBypasses();
    await hitFloorPileWithWand(wand, 11, 10);
    assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === STATUE), false);
});

void test('saving and restoring discards object bypass marks', async () => {
    freshObjectRoom();
    const storage = memoryStorage();
    game.plname = 'Bypasses';
    await addInventoryObject(DAGGER, { bypass: true });
    game.context.bypasses = true;

    assert.equal(await saveGame(storage), true);
    resetGame();
    assert.equal(restoreGame('Bypasses', storage), true);

    assert.equal(!!game.inventory[0]?.bypass, false);
    clearBypasses();
    assert.equal(game.context.bypasses, false);
});

for (const style of [MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL] as const) {
    void test(`multi-drop in menu style ${style} protects dropped items until its native cleanup boundary`, async () => {
        freshObjectRoom({ flags: { menu_style: style, verbose: false } });
        requirePlayingGame(game);
        const dagger = await addInventoryObject(DAGGER, { spe: 4 });
        const club = await addInventoryObject(CLUB, { spe: 3, bknown: false });
        const input = resetInputState();
        installPagerInput(input, { limit: 100, expected: /That was all/ });
        input.feed(style === MENU_TRADITIONAL ? 'a\n'
            : style === MENU_FULL ? 'Aa\n' : `${dagger.invlet}${club.invlet}\n`);

        await rhack('D'.charCodeAt(0));
        assert.equal(game.context.move, style === MENU_TRADITIONAL ? 0 : 1);
        assert.equal(dagger.where, 'floor');
        assert.equal(club.where, 'floor');
        const wand = await chargedWand(WAN_CANCELLATION);
        await hitFloorPileWithWand(wand, game.u.ux, game.u.uy);

        // askchain() clears every chain before returning. menu_drop() clears
        // only the inventory, leaving its dropped objects protected this move.
        assert.equal(dagger.spe, style === MENU_TRADITIONAL ? 0 : 4);
        assert.equal(club.spe, style === MENU_TRADITIONAL ? 0 : 3);
        clearBypasses();
        await hitFloorPileWithWand(wand, game.u.ux, game.u.uy);
        assert.equal(dagger.spe, 0);
        assert.equal(club.spe, 0);
    });
}
