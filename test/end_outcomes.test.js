import assert from 'node:assert/strict';
import test from 'node:test';
import { STONING } from '../js/const.js';
import { doquit } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { finishMonsterAttackDeath } from '../js/monster_attack_death.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
function endingRoom() {
    freshObjectRoom({ flags: { bones: false, disclose: 'none', tombstone: false } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const screens = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            screens.push(screen);
            assert.ok(screens.length < 12, `Unexpected ending prompt: ${screen}`);
            return (screen.includes('Really quit without saving?') ? 'y' : ' ').charCodeAt(0);
        },
    };
    return screens;
}
void test('a petrifying monster uses turned to stone in the final summary', async () => {
    const screens = endingRoom();
    const cockatrice = await createMonsterAt('cockatrice', 11, 10);
    await finishMonsterAttackDeath(cockatrice, { deathType: STONING });
    const summary = screens.find(screen => screen.includes('You were level')) ?? '';
    assert.match(summary, /You turned to stone in/);
    assert.match(summary, /when you turned to stone\./);
});
void test('death on the Astral Plane omits a dungeon level number', async () => {
    const screens = endingRoom();
    game.dungeons = [createDungeon({ dname: 'The Elemental Planes', num_dunlevs: 5 })];
    game.astral_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.u.uz = { dnum: 0, dlevel: 1 };
    await loseHeroHp(100, 'falling rock');
    const summary = screens.find(screen => screen.includes('You were level')) ?? '';
    assert.match(summary, /You died in The Astral Plane with/);
    assert.doesNotMatch(summary, /on dungeon level/);
});
void test('quitting Fort Ludios omits the dungeon level suffix', async () => {
    const screens = endingRoom();
    game.dungeons = [createDungeon({ dname: 'Fort Ludios', num_dunlevs: 1 })];
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.knox_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    await doquit();
    const summary = screens.find(screen => screen.includes('You were level')) ?? '';
    assert.match(summary, /You quit in Fort Ludios with/);
    assert.doesNotMatch(summary, /on dungeon level/);
});
void test('a one-level dungeon still shows its depth when it is not Fort Ludios', async () => {
    const screens = endingRoom();
    game.dungeons = [createDungeon({ dname: 'The Tutorial', num_dunlevs: 1 })];
    game.u.uz = { dnum: 0, dlevel: 1 };
    await doquit();
    const summary = screens.find(screen => screen.includes('You were level')) ?? '';
    assert.match(summary, /You quit in The Tutorial on dungeon level 1 with/);
});
//# sourceMappingURL=end_outcomes.test.js.map