import assert from 'node:assert/strict';
import test from 'node:test';
import { W_ARM, W_ARMC, W_ARMS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { createPlayerMonster, createPlayerMonsters } from '../js/mplayer.js';
import { MONSTER_NAME, monsterIsPlayerMonster } from '../js/monster_data.js';
import { FAKE_AMULET_OF_YENDOR, ROBE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
for (const { endgame, special, description } of [
    { endgame: false, special: true, description: 'a special-player request is ignored outside the endgame' },
    { endgame: true, special: false, description: 'an ordinary player monster stays ordinary in the endgame' },
]) {
    void test(description, async () => {
        freshObjectRoom({ gameplaySeed: 17n });
        game.astral_level = createSpecialLevel({ dnum: 5, dlevel: 1 });
        if (endgame)
            game.u.uz = { dnum: 5, dlevel: 2 };
        const knight = await createPlayerMonster(MONSTER_NAME.indexOf('knight'), 11, 10, special);
        assert.ok(knight);
        assert.ok(knight.m_lev >= 1 && knight.m_lev <= 16);
        assert.ok(knight.mhp >= knight.m_lev + 30 && knight.mhp <= knight.m_lev * 10 + 30);
        assert.equal(knight.mhp, knight.mhpmax);
        assert.equal(knight.mgivenname, undefined);
        assert.equal(knight.minvent?.some(object => object.otyp === FAKE_AMULET_OF_YENDOR), false);
        assert.equal(knight.mpeaceful, 0);
    });
}
for (const plane of [1, 2]) {
    void test(`a special knight gets endgame hit dice, a name, and worn armor on plane ${plane}`, async () => {
        freshObjectRoom({ gameplaySeed: 17n });
        game.astral_level = createSpecialLevel({ dnum: 5, dlevel: 1 });
        game.u.uz = { dnum: 5, dlevel: plane };
        const knight = await createPlayerMonster(MONSTER_NAME.indexOf('knight'), 11, 10, true);
        assert.ok(knight);
        assert.ok(knight.m_lev >= 15 && knight.m_lev <= 30);
        assert.ok(knight.mhp >= knight.m_lev + 31 && knight.mhp <= knight.m_lev * 10 + 60);
        assert.equal(knight.mhp, knight.mhpmax);
        assert.match(knight.mgivenname ?? '', /^\S+ the .+/);
        assert.equal(knight.mpeaceful, 0);
        assert.ok(knight.minvent?.some(object => object.otyp === FAKE_AMULET_OF_YENDOR));
        const suit = knight.minvent?.find(object => (object.owornmask ?? 0) & W_ARM);
        assert.ok(suit, 'a special knight must put on its generated suit');
        assert.equal(suit.oeroded, 0);
        assert.equal(suit.oeroded2, 0);
        assert.ok(suit.spe >= -3 && suit.spe <= 7);
        assert.equal(knight.mcanmove, 1);
        assert.equal(knight.mfrozen ?? 0, 0);
    });
}
for (const species of ['monk', 'wizard']) {
    void test(`a special ${species} follows its role's armor restrictions`, async () => {
        freshObjectRoom({ gameplaySeed: 17n });
        game.astral_level = createSpecialLevel({ dnum: 5, dlevel: 1 });
        game.u.uz = { dnum: 5, dlevel: 1 };
        const monster = await createPlayerMonster(MONSTER_NAME.indexOf(species), 11, 10, true);
        assert.ok(monster);
        if (species === 'monk') {
            assert.equal(monster.minvent?.some(object => (object.owornmask ?? 0) & W_ARM), false);
            assert.ok(monster.minvent?.some(object => object.otyp === ROBE
                && ((object.owornmask ?? 0) & W_ARMC)));
        }
        else {
            assert.equal(monster.minvent?.some(object => (object.owornmask ?? 0) & W_ARMS), false);
        }
    });
}
void test('a developer name already used by a player monster is skipped', async () => {
    freshObjectRoom({ gameplaySeed: 17n });
    game.astral_level = createSpecialLevel({ dnum: 5, dlevel: 1 });
    game.u.uz = { dnum: 5, dlevel: 1 };
    const species = MONSTER_NAME.indexOf('knight');
    const first = await createPlayerMonster(species, 11, 10, true);
    assert.ok(first?.mgivenname);
    initRng(17n);
    const second = await createPlayerMonster(species, 12, 10, true);
    assert.ok(second?.mgivenname);
    assert.notEqual(second.mgivenname.split(' the ')[0], first.mgivenname.split(' the ')[0]);
});
void test('a special valkyrie gets a female name and title', async () => {
    freshObjectRoom({ gameplaySeed: 17n });
    game.astral_level = createSpecialLevel({ dnum: 5, dlevel: 1 });
    game.u.uz = { dnum: 5, dlevel: 1 };
    const valkyrie = await createPlayerMonster(MONSTER_NAME.indexOf('valkyrie'), 11, 10, true);
    assert.ok(valkyrie);
    assert.equal(valkyrie.female, true);
    assert.match(valkyrie.mgivenname ?? '', /^(Eve|Maud|Janet) the .+/);
});
void test('a player-monster group occupies distinct free squares', async () => {
    const level = freshObjectRoom({ gameplaySeed: 17n, left: 2, right: 77, top: 1, bottom: 19 });
    game.in_mklev = true;
    await createPlayerMonsters(4, false);
    assert.equal(level.monsters.length, 4);
    const squares = new Set();
    for (const monster of level.monsters) {
        assert.ok(monsterIsPlayerMonster(monster.mnum));
        assert.notEqual(`${monster.mx},${monster.my}`, `${game.u.ux},${game.u.uy}`);
        squares.add(`${monster.mx},${monster.my}`);
    }
    assert.equal(squares.size, 4);
});
for (const sameRole of [false, true]) {
    void test(`an endgame opponent challenges a hero of ${sameRole ? 'the same' : 'another'} role`, async () => {
        freshObjectRoom({ role: sameRole ? 'knight' : 'caveman', gameplaySeed: 17n });
        game.astral_level = createSpecialLevel({ dnum: 5, dlevel: 1 });
        game.u.uz = { dnum: 5, dlevel: 1 };
        const knight = await createMonsterAt('knight', 11, 10);
        knight.mpeaceful = 0;
        knight.msleeping = 0;
        const speeches = sameRole ? [
            "I can't win, and neither will you!", "You don't deserve to win!",
            'Mine should be the honor, not yours!',
        ] : ['The low-life wants to talk, eh?', 'Fight, scum!', 'Here is what I have to say!'];
        await runExtendedCommand('chat', 'l');
        assert.ok(speeches.some(speech => game._pending_message === `"Talk? -- ${speech}"`), `Unexpected player-monster response: ${game._pending_message}`);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=mplayer_audit.test.js.map