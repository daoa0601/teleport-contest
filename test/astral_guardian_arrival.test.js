import assert from 'node:assert/strict';
import test from 'node:test';
import { init_dungeons } from '../js/dungeon.js';
import { game, requireInitializedGame, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { MONSTER_NAME, monsterIsPlayerMonster } from '../js/monster_data.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION } from '../js/object_data.js';
import { selectHandToHandWeapon } from '../js/monster_weapon.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { flush_screen } from '../js/display.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function topLine() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
// Enter Astral as a new level and return each top line the hero acknowledges,
// followed by the line left showing once arrival finishes.
async function arriveOnAstral(t, { record, deaf = false, blind = false }) {
    freshObjectRoom({
        flags: { bones: false }, gameplaySeed: 37n,
        hero: { ualign: { type: 0, record }, uconduct: { pets: 1 } },
    });
    requirePlayingGame(game);
    // Extrinsic deafness survives Hear_again(); timed blindness lasts the arrival.
    if (deaf)
        game.u.extrinsicDeaf = true;
    if (blind)
        game.u.blindTurns = 50;
    await init_dungeons();
    await startLuaCore(t);
    const astral = game.astral_level;
    assert.ok(astral, 'the dungeon graph must identify Astral');
    const input = resetInputState();
    const lines = [];
    input.beforeRead = () => {
        lines.push(topLine());
        input.feed(' ');
    };
    await gotoLevel(astral);
    await flush_screen();
    lines.push(topLine());
    // The guardian speech follows the Astral level's own arrival messages.
    const levelMessages = lines.findIndex(line => line.startsWith('You sense alarm'));
    assert.ok(levelMessages >= 0, `Astral arrival messages are missing: ${lines.join(' | ')}`);
    return lines.slice(levelMessages + 1);
}
for (const pets of [0, 1]) {
    void test(`Astral arrival grants an equipped guardian while ${pets ? 'keeping' : 'preserving petless'} conduct`, async (t) => {
        freshObjectRoom({
            flags: { bones: false }, gameplaySeed: 37n,
            hero: { ualign: { type: 0, record: 9 }, uconduct: { pets } },
        });
        requirePlayingGame(game);
        await init_dungeons();
        await startLuaCore(t);
        const astral = game.astral_level;
        assert.ok(astral, 'the dungeon graph must identify Astral');
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        await gotoLevel(astral);
        const guardian = game.level.monsters.slice().reverse().find(monster => monster.isminion
            && monster.mpeaceful && monster.mnum === MONSTER_NAME.indexOf('Angel')
            && Math.max(Math.abs(monster.mx - game.u.ux), Math.abs(monster.my - game.u.uy)) === 1);
        assert.ok(guardian, 'the worthy hero must receive a peaceful guardian');
        assert.equal(guardian.mtame ?? 0, pets ? 10 : 0);
        assert.equal(game.u.uconduct.pets, pets ? 2 : 0);
        assert.equal(guardian.edog ?? guardian.mextra?.edog, undefined);
        assert.ok(guardian.m_lev >= 15 && guardian.m_lev <= 22);
        assert.ok(guardian.mhp >= guardian.m_lev + 31);
        const weapon = selectHandToHandWeapon(guardian);
        assert.ok(weapon?.blessed, 'the guardian must have a blessed melee weapon');
        assert.ok(guardian.minvent?.some(object => object.otyp === AMULET_OF_REFLECTION || object.otyp === SHIELD_OF_REFLECTION));
        const opponents = game.level.monsters.filter(monster => monsterIsPlayerMonster(monster.mnum));
        assert.ok(opponents.length >= 3 && opponents.length <= 6);
        assert.ok(opponents.every(monster => monster.mgivenname && !monster.mpeaceful));
    });
}
void test('Conflict replaces the Astral guardian reward with hostile angels', async (t) => {
    freshObjectRoom({ flags: { bones: false }, gameplaySeed: 37n,
        hero: { ualign: { type: 0, record: 9 } } });
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    const astral = game.astral_level;
    assert.ok(astral);
    grantIntrinsicProperty('conflict', 'outside');
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await gotoLevel(astral);
    const angels = game.level.monsters.filter(monster => monster.isminion
        && monster.mnum === MONSTER_NAME.indexOf('Angel')
        && Math.max(Math.abs(monster.mx - game.u.ux), Math.abs(monster.my - game.u.uy)) === 1);
    assert.ok(angels.length >= 2 && angels.length <= 4, `Conflict must send two to four nearby angels; found ${angels.length}`);
    assert.ok(angels.every(monster => !monster.mpeaceful && !monster.mtame));
});
void test('an unworthy hero reaches Astral without a voice or a guardian', async (t) => {
    const after = await arriveOnAstral(t, { record: 8 });
    assert.deepEqual(after, []);
    const state = requireInitializedGame();
    assert.equal(state.level.monsters.some(monster => monster.mtame), false);
    assert.equal(state.u.uconduct.pets, 1);
});
for (const [senses, expected] of [
    [{ record: 9 }, ['A voice whispers:  "Thou hast been worthy of me!"--More--',
            'An angel appears near you.']],
    [{ record: 9, deaf: true }, ['You feel a soft voice:  "Thou hast been worthy of me!"--More--',
            'An angel appears near you.']],
    [{ record: 9, blind: true }, ['A voice whispers:  "Thou hast been worthy of me!"--More--',
            'You feel the presence of a friendly angel near you.']],
]) {
    const label = senses.deaf ? 'a deaf' : senses.blind ? 'a blind' : 'a seeing, hearing';
    void test(`${label} worthy hero perceives the guardian's arrival natively`, async (t) => {
        assert.deepEqual(await arriveOnAstral(t, senses), expected);
        const state = requireInitializedGame();
        const guardian = state.level.monsters.find(monster => monster.mtame === 10);
        assert.equal(guardian?.mnum, MONSTER_NAME.indexOf('Angel'));
        assert.equal(state.u.uconduct.pets, 2);
    });
}
//# sourceMappingURL=astral_guardian_arrival.test.js.map