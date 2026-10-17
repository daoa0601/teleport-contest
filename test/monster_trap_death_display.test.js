import assert from 'node:assert/strict';
import test from 'node:test';
import { ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, LANDMINE, NO_MINVENT, PIT, ROCKTRAP, SPIKED_PIT, } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { CORPSE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [type, name] of [
    [ARROW_TRAP, 'arrow'], [DART_TRAP, 'dart'], [ROCKTRAP, 'falling-rock'],
    [BEAR_TRAP, 'bear'], [FIRE_TRAP, 'fire'], [PIT, 'pit'],
    [SPIKED_PIT, 'spiked pit'], [LANDMINE, 'land-mine'],
]) {
    void test(`a lethal ${name} hit refreshes the hallucinated corpse after its creation`, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('hill giant') });
        initRng(1n);
        newsym(11, 10);
        const firstAppearance = glyphAt(11, 10);
        newsym(11, 10);
        const refreshedAppearance = glyphAt(11, 10);
        assert.ok(firstAppearance?.kind === 'object');
        assert.ok(refreshedAppearance?.kind === 'object');
        assert.notEqual(firstAppearance.glyph, refreshedAppearance.glyph);
        const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        monster.mhp = 1;
        // An unseen victim has no hallucinated name or monster glyph to redraw.
        monster.minvis = true;
        addTrap(level, type, 11, 10, { tseen: true });
        initRng(1n);
        const action = await triggerImmediateMonsterTrap(monster, game, {
            random: limit => limit - 1, rollOne: sides => sides, rollDice: () => 8,
        });
        await resumeDeferredMonsterTrap(action, game, {
            random: limit => limit === 5 ? 1 : limit - 1, rollOne: sides => sides,
            rollDice: () => 8, publish: async () => { },
        });
        assert.equal(monster.dead, true);
        const shown = glyphAt(11, 10);
        assert.ok(shown?.kind === 'object');
        assert.equal(shown.glyph, refreshedAppearance.glyph, 'thitm must leave the refreshed appearance, rather than make_corpse\'s first appearance');
    });
}
//# sourceMappingURL=monster_trap_death_display.test.js.map