import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAR_TRAP, PIT, SPIKED_PIT, WEB } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { BOULDER } from '../js/object_data.js';
import { fillPitWithBoulderAt } from '../js/pit_fill.js';
import { initRng } from '../js/rng.js';
import { tryMonsterTrapEscape } from '../js/monster_trap_escape.js';
import { floorObject } from './support/game-objects.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
void test('a hallucinating hero sees monsters pull free of varying imaginary traps', async () => {
    const { monster } = await freshMonsterTrapRoom(WEB, { monster: { species: 'gnome' } });
    requirePlayingGame(game);
    await makeHallucinated(100, { talk: false });
    const names = new Set();
    for (let attempt = 0; attempt < 12; attempt++) {
        monster.mtrapped = 1;
        await tryMonsterTrapEscape(monster, game, {
            random: () => 0,
            publish: message => { names.add(message.replace(/^.* pulls free of the (.*)\.$/u, '$1')); },
        });
        assert.equal(monster.mtrapped, 0);
    }
    assert.ok(names.size > 1, `Trap names: ${[...names].join(', ')}`);
});
for (const type of [BEAR_TRAP, SPIKED_PIT]) {
    void test(`eating ${type === BEAR_TRAP ? 'a bear trap' : 'pit spikes'} waits for the next monster redraw`, async () => {
        const { level, monster, trap } = await freshMonsterTrapRoom(type, {
            room: { hero: { hallucinationTurns: 20 } },
            monster: { species: 'rust monster', mtrapped: 1 },
            trap: { tseen: true },
        });
        initRng(1n);
        newsym(monster.mx, monster.my);
        const before = glyphAt(monster.mx, monster.my);
        assert.ok(before?.kind === 'monster');
        await tryMonsterTrapEscape(monster, game, { random: () => 1, publish: () => { } });
        assert.equal(monster.meating, 5);
        assert.equal(monster.mtrapped, type === BEAR_TRAP ? 0 : 1);
        if (type === BEAR_TRAP)
            assert.equal(level.traps.includes(trap), false);
        else
            assert.equal(trap.ttyp, PIT);
        assert.equal(glyphAt(monster.mx, monster.my)?.glyph, before.glyph, 'mintrap leaves the current appearance for dochug to refresh');
        newsym(monster.mx, monster.my);
        assert.notEqual(glyphAt(monster.mx, monster.my)?.glyph, before.glyph);
    });
}
void test('escaping a boulder-covered pit leaves the same appearance as the settling boulder', async () => {
    const reference = await boulderCoveredPit();
    reference.monster.mtrapped = 0;
    await fillPitWithBoulderAt(reference.monster.mx, reference.monster.my, game, { publish: () => { } });
    const settled = glyphAt(reference.monster.mx, reference.monster.my);
    assert.ok(settled?.kind === 'monster');
    const { level, monster, trap, boulder } = await boulderCoveredPit();
    await tryMonsterTrapEscape(monster, game, { random: () => 0, publish: () => { } });
    assert.equal(monster.mtrapped, 0);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(boulder.where, 'gone');
    assert.equal(glyphAt(monster.mx, monster.my)?.glyph, settled.glyph, 'mintrap must preserve the appearance already refreshed by the settling boulder');
});
async function boulderCoveredPit() {
    const room = await freshMonsterTrapRoom(PIT, {
        room: { hero: { hallucinationTurns: 20, detectMonsters: true } },
        monster: { species: 'goblin', minvis: 1, mtrapped: 1 },
        trap: { tseen: true },
    });
    const boulder = await floorObject(BOULDER, room.monster.mx, room.monster.my);
    initRng(1n);
    newsym(room.monster.mx, room.monster.my);
    return { ...room, boulder };
}
//# sourceMappingURL=hallucinated_trap_escape.test.js.map