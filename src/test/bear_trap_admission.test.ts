import test from 'node:test';
import assert from 'node:assert/strict';

import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { BEAR_TRAP, TT_BEARTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { FUMBLE_BOOTS, LEVITATION_BOOTS } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const admission of ['ordinary', 'forceTrap', 'failedUntrap', 'forceBungle', 'fumbling']) {
    void test(`known bear-trap avoidance respects ${admission}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        if (admission === 'fumbling') {
            const boots = await addInventoryObject(FUMBLE_BOOTS);
            wearHeroArmor(boots);
            await applyArmorOnEffects(boots);
            assert.equal(game.u.fumbling, true);
        }
        const observer = await createMonsterAt('goblin', 11, 10);
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10, { tseen: true });
        const trapBit = 1 << (BEAR_TRAP - 1);
        assert.equal((observer.mtrapseen ?? 0) & trapBit, 0);
        pushKeys(' '.repeat(60));
        initRng(1n);

        await triggerHeroTrap(
            trap,
            ['ordinary', 'fumbling'].includes(admission) ? {} : { [admission]: true },
        );

        const caught = admission !== 'ordinary';
        assert.equal(!!game.u.utrap, caught);
        assert.equal(game.u.uhp < 100, caught);
        assert.equal(!!((observer.mtrapseen ?? 0) & trapBit), caught);
        if (caught) assert.equal(game.u.utraptype, TT_BEARTRAP);
        else assert.match(game._pending_message, /You escape a bear trap/);
    });
}

for (const [airborne, forced, sitting] of [
    ['levitation', false, false],
    ['levitation', true, false],
    ['flying', false, false],
    ['flying', false, true],
] as const) {
    void test(`${airborne} over a bear trap${forced ? ' when forced' : sitting ? ' when sitting' : ''}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        pushKeys(' '.repeat(80));
        if (airborne === 'levitation') {
            const boots = await addInventoryObject(LEVITATION_BOOTS);
            wearHeroArmor(boots);
            await applyArmorOnEffects(boots);
            assert.equal(game.u.levitating, true);
        } else {
            installPolymorphedHero('vampire', { hitPoints: 100 });
            assert.equal(game.u.flying, true);
        }
        const observer = await createMonsterAt('goblin', 11, 10);
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        initRng(1n);

        await triggerHeroTrap(trap, { forceTrap: forced, viaSitting: sitting });

        const caught = forced || sitting;
        assert.equal(!!game.u.utrap, caught);
        assert.equal(!!trap.tseen, caught);
        assert.equal(!!((observer.mtrapseen ?? 0) & (1 << (BEAR_TRAP - 1))), caught);
        assert.equal((airborne === 'flying' ? game.u.mh : game.u.uhp) < 100, caught);
    });
}

void test('hallucinated bear-trap feedback can use the current female role name', async () => {
    freshObjectRoom({ role: 'caveman', flags: { female: true }, hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    pushKeys(' '.repeat(80));
    const boots = await addInventoryObject(LEVITATION_BOOTS);
    wearHeroArmor(boots);
    await applyArmorOnEffects(boots);
    const trap = addTrap(game.level, BEAR_TRAP, 10, 10, { tseen: true });
    initRng(51n);

    await triggerHeroTrap(trap);

    assert.match(game._pending_message, /You float over a cavewoman trap\./);
    assert.ok(!game.u.utrap);
});
