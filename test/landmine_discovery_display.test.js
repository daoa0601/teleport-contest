import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { requireScreenCell } from './support/screen.js';
for (const detonates of [false, true]) {
    void test(`a flying monster reveals a mine after the trigger message${detonates ? ' and is drawn before detonation' : ''}`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
            monster: { species: 'red dragon', hitPoints: 1000 }, trap: { tseen: false },
        });
        requirePlayingGame(game);
        placeMonsterAt(monster, 12, 10);
        newsym(11, 10);
        newsym(12, 10);
        await flush_screen(1);
        placeMonsterAt(monster, 11, 10);
        newsym(12, 10);
        const shown = [];
        const random = (limit) => limit === 3 ? (detonates ? 0 : 1) : limit - 1;
        const publish = async (message) => {
            await flush_screen(1);
            shown.push({ message, glyph: requireScreenCell(10, 11).ch, seen: !!trap.tseen });
        };
        const action = await triggerImmediateMonsterTrap(monster, game, { force: true, random, rollOne: () => 1 });
        await resumeDeferredMonsterTrap(action, game, { publish, random, rollOne: () => 1 });
        await publish('You wait.');
        assert.match(shown[0]?.message ?? '', /trigger appears/);
        assert.equal(shown[0]?.seen, false, 'the trigger announcement precedes seetrap');
        assert.equal(shown[0]?.glyph, '.');
        assert.equal(shown[1]?.glyph, 'D', 'the next message sees the newly revealed occupant');
        assert.equal(shown[1]?.seen, true);
        if (detonates)
            assert.match(shown[1]?.message ?? '', /air currents/);
    });
}
void test('a grounded monster is drawn before announcing its land mine explosion', async () => {
    const { monster } = await freshMonsterTrapRoom(LANDMINE, {
        monster: { hitPoints: 1000 }, trap: { tseen: false },
    });
    requirePlayingGame(game);
    placeMonsterAt(monster, 12, 10);
    newsym(11, 10);
    await flush_screen(1);
    placeMonsterAt(monster, 11, 10);
    let shownAtExplosion;
    const random = (limit) => limit - 1;
    const action = await triggerImmediateMonsterTrap(monster, game, { random, rollOne: () => 1 });
    await resumeDeferredMonsterTrap(action, game, {
        random, rollOne: () => 1,
        publish: async (message) => {
            await flush_screen(1);
            if (message.includes('triggers a land mine'))
                shownAtExplosion = requireScreenCell(10, 11).ch;
        },
    });
    assert.equal(shownAtExplosion, 'H');
});
//# sourceMappingURL=landmine_discovery_display.test.js.map