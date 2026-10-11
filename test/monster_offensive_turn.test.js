import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, NO_WEAPON_WANTED } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { EXPENSIVE_CAMERA, POT_ACID, WAN_STRIKING } from '../js/object_data.js';
import { dopray } from '../js/pray.js';
import { heroIsBlind } from '../js/senses.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function armedGoblin(otyp, cursed = false, x = 11) {
    freshObjectRoom({ flags: { verbose: false }, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('goblin', x, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    monster.mhp = monster.mhpmax = 100;
    monster.weaponCheck = NO_WEAPON_WANTED;
    const object = await knownObject(otyp, { spe: 2, cursed });
    await addObjectToMonsterInventory(monster, object, game);
    installPagerInput(resetInputState(), {
        expected: /goblin|wand|potion|burns|shards|evaporates|camera|picture|blinded|pulls back|praying|shimmering/i,
        limit: 12,
    });
    return { monster, object };
}
void test('throwing an acid potion spends the complete monster attack', async () => {
    const { monster, object } = await armedGoblin(POT_ACID);
    requirePlayingGame(game);
    const result = await performMonsterHeroAttack(monster, game, {
        random: () => 1, rollOne: () => 2,
        rollDice: (count, sides) => count * sides,
    });
    assert.equal(result.nativeResult, 0);
    assert.equal(result.heroDied, false);
    assert.equal(game.u.uhp, 90, 'only the bottle impact and acid damage reach the hero');
    assert.equal(object.where, 'gone');
    assert.equal(monster.minvent?.includes(object), false);
});
void test('a surviving wand backfire resumes the same ordinary monster attack', async () => {
    const { monster, object } = await armedGoblin(WAN_STRIKING, true);
    requirePlayingGame(game);
    const result = await performMonsterHeroAttack(monster, game, {
        random: () => 0, rollOne: () => 1, rollDice: count => count,
    });
    assert.equal(result.nativeResult, 0);
    assert.equal(object.where, 'gone');
    assert.equal(monster.mhp, 96);
    assert.ok(game.u.uhp < 100, 'the goblin attacks after losing its wand');
});
void test('a camera returns the native stop result without killing its user', async () => {
    const { monster, object } = await armedGoblin(EXPENSIVE_CAMERA);
    requirePlayingGame(game);
    const result = await performMonsterHeroAttack(monster, game, { random: () => 0, rollOne: () => 1 });
    assert.equal(result.nativeResult, 1);
    assert.equal(monster.mhp, 100);
    assert.equal(Boolean(monster.dead), false);
    assert.equal(object.spe, 1);
    assert.equal(heroIsBlind(game), true);
    assert.equal(game.u.uhp, 100, 'the goblin does not add a melee hit after the flash');
});
for (const { actualX, apparentX, feedback } of [
    { actualX: 11, apparentX: 10, feedback: true },
    { actualX: 11, apparentX: 15, feedback: false },
    { actualX: 14, apparentX: 13, feedback: true },
]) {
    void test(`prayer protects the hero while the goblin at ${actualX} aims at ${apparentX}`, async () => {
        const { monster, object } = await armedGoblin(WAN_STRIKING, false, actualX);
        requirePlayingGame(game);
        game.flags.paranoia_bits = 0;
        game.flags.debug = false;
        game.u.ublesscnt = 0;
        game.u.ualign.record = 10;
        await dopray();
        assert.equal(game.u.invulnerable, true);
        monster.mux = apparentX;
        const result = await performMonsterHeroAttack(monster, game);
        assert.equal(result.nativeResult, 0);
        assert.equal(object.spe, 2);
        assert.equal(game.u.uhp, 100);
        assert.equal(/starts to attack you, but pulls back/.test(game._pending_message), feedback);
    });
}
//# sourceMappingURL=monster_offensive_turn.test.js.map