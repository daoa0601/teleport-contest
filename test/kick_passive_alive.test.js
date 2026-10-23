import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { MAGIC_TRAP, MM_NOGRP, MM_NOWAIT, NO_MINVENT, ROCKTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { IRON_SHOES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function kickIntoTrap(species, hitPoints, seed, trapType = ROCKTRAP) {
    const level = freshObjectRoom({
        role: 'monk',
        flags: { verbose: true },
        hero: {
            uhp: 200, uhpmax: 200,
            // The kick can reel the target without doing direct damage.
            acurr: { a: [3, 12, 13, 3, 3, 12] },
            amax: { a: [3, 12, 13, 3, 3, 12] },
        },
    });
    const boots = await addInventoryObject(IRON_SHOES, { spe: 0 });
    wearHeroArmor(boots);
    const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mhp = hitPoints;
    monster.mhpmax = 100;
    const trap = addTrap(level, trapType, 12, 10);
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /kick|reels|rock|killed|splashed|rust|corrode|frozen|flame/, limit: 10 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    initRng(seed);
    await kickDirection('l');
    messages.push(game._pending_message);
    return { monster, boots, trap, messages: messages.join('\n') };
}
for (const survives of [false, true]) {
    void test(`a floating eye ${survives ? 'surviving' : 'killed by'} a kick reel's magic trap ${survives ? 'can' : 'cannot'} paralyze the hero`, async () => {
        let reeled = 0;
        let frozen = 0;
        for (let seed = 1; seed <= 200; seed++) {
            // Floating eyes stay above floor triggers; magic traps can burn them.
            const { monster, messages } = await kickIntoTrap('floating eye', survives ? 100 : 1, BigInt(seed), MAGIC_TRAP);
            if (!messages.includes('tower of flame'))
                continue;
            reeled++;
            assert.equal(monster.mx, 12);
            assert.equal(monster.mhp > 0, survives, `Unexpected magic-trap survival (seed ${seed}).`);
            if ((game._helplessTurns ?? 0) > 0)
                frozen++;
            if (!survives) {
                assert.equal(game._helplessTurns ?? 0, 0, `A dead eye froze the hero (seed ${seed}).`);
                assert.doesNotMatch(messages, /frozen/);
            }
        }
        assert.ok(reeled > 0, 'A martial kick must reel the eye onto the trap.');
        if (survives)
            assert.ok(frozen > 0, 'A surviving eye must sometimes freeze the hero.');
    });
    void test(`an acid blob ${survives ? 'surviving' : 'killed by'} a kick reel's rock trap can still splash the hero and corrode boots`, async () => {
        let splashed = false;
        let corroded = false;
        for (let seed = 1; seed <= 60 && (!splashed || !corroded); seed++) {
            const { monster, boots, trap, messages } = await kickIntoTrap('acid blob', survives ? 100 : 1, BigInt(seed));
            requirePlayingGame(game);
            if (monster.mx !== 12)
                continue;
            assert.equal(trap.once, true);
            assert.equal(monster.mhp > 0, survives);
            if (game.u.uhp < 200) {
                splashed = true;
                assert.match(messages, /You are splashed by the acid blob's acid!/);
            }
            if ((boots.oeroded2 ?? 0) > 0) {
                corroded = true;
                assert.match(messages, /iron shoes corrode/);
            }
        }
        assert.ok(splashed, 'Acid contact must sometimes damage the hero after the trap resolves.');
        assert.ok(corroded, 'Acid contact must sometimes corrode the kicking boots after the trap resolves.');
    });
    void test(`a rust monster ${survives ? 'surviving' : 'killed by'} a kick reel's rock trap still rusts the kicking boots`, async () => {
        let reeled = false;
        for (let seed = 1; seed <= 20 && !reeled; seed++) {
            const { monster, boots, trap, messages } = await kickIntoTrap('rust monster', survives ? 100 : 1, BigInt(seed));
            if (monster.mx !== 12)
                continue;
            reeled = true;
            assert.equal(trap.once, true);
            assert.equal(monster.mhp > 0, survives);
            assert.equal(boots.oeroded, 1);
            assert.match(messages, /iron shoes rust/);
            assert.equal(game.u.uhp, 200);
        }
        assert.ok(reeled, 'A martial kick must reel the rust monster onto the trap.');
    });
}
//# sourceMappingURL=kick_passive_alive.test.js.map