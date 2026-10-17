import { createDungeon } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';
import { armorBaseBonus } from '../js/armor.js';
import { findMonsterArmorClass } from '../js/monworn.js';
import { W_ARM } from '../js/const.js';
import { LEATHER_ARMOR } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { equipMonsterObject } from './support/monsters.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { breatheFromMonster } from '../js/breath_ray.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { AT_BREA } from '../js/monster_attack_types.js';
import { initRng } from '../js/rng.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { addInventoryObject } from './support/game-objects.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom, installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const lifesaving of [false, true]) {
    void test(`monster breath ${lifesaving ? 'resumes the same ray after life saving' : 'finishes a fatal hero hit with its default death owner'}`, async () => {
        freshObjectRoom({ left: 7, right: 30, top: 6, bottom: 14,
            hero: { uhp: 1, uhpmax: 100, uac: 30 },
            flags: { disclose: '-i -a -v -c -o' } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({
                dname: 'The Dungeons of Doom',
                num_dunlevs: game.u.uz.dlevel, dunlev_ureached: game.u.uz.dlevel,
            })];
        const dragon = await createMonsterAt('red dragon', 8, 10);
        const victim = await createMonsterAt('goblin', 11, 10);
        victim.mhp = 1;
        const victimArmor = await knownObject(LEATHER_ARMOR, { initialize: false,
            spe: findMonsterArmorClass(victim) - armorBaseBonus(LEATHER_ARMOR) - 30 });
        await equipMonsterObject(victim, victimArmor, W_ARM);
        assert.equal(findMonsterArmorClass(victim), 30);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        const attacks = MONSTER_ATTACKS[dragon.mnum];
        assert.ok(attacks);
        const attack = attacks.find(a => a[0] === AT_BREA);
        assert.ok(attack);
        installPagerInput(resetInputState(), {
            expected: /blast of fire|smoulders|die|But wait|medallion|amulet of life saving|feel much better|REST|PEACE|Goodbye|points/i,
            limit: 12,
        });
        initRng(1n);
        const result = await breatheFromMonster(dragon, { mx: 10, my: 10 }, { attack });
        assert.equal(result.heroDied, !lifesaving);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        if (lifesaving)
            assert.equal(game.level.monsters.includes(victim), false);
        else
            assert.equal(victim.mhp, 1);
    });
}
void test('a swallowed wolf breathes into its engulfer without ending the engulf', async () => {
    freshMonsterAbilityRoom('winter wolf cub', { energy: 30 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    worm.mhp = worm.mhpmax = 100;
    await installSwallowedHero(worm);
    initRng(1n);
    installPagerInput(resetInputState(), { expected: /blast of frost|purple worm/i, limit: 3 });
    await runMonsterAbilityCommand('l');
    assert.ok(worm.mhp < 100);
    assert.equal(game.u.ustuck, worm);
    assert.ok(game.u.uswallow);
    assert.equal(game.u.uen, 15);
    assert.match(game._pending_message, /The blast of frost rips into the purple worm[.!]/);
});
void test('monster breath does not cross the map while the hero is swallowed', async () => {
    freshMonsterAbilityRoom('winter wolf cub', { energy: 30 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    await installSwallowedHero(worm);
    const dragon = await createMonsterAt('red dragon', 8, 12);
    const target = await createMonsterAt('goblin', 10, 12);
    const targetArmor = await knownObject(LEATHER_ARMOR, { initialize: false,
        spe: findMonsterArmorClass(target) - armorBaseBonus(LEATHER_ARMOR) - 30 });
    await equipMonsterObject(target, targetArmor, W_ARM);
    assert.equal(findMonsterArmorClass(target), 30);
    const health = target.mhp;
    const attacks = MONSTER_ATTACKS[dragon.mnum];
    assert.ok(attacks);
    const attack = attacks.find(a => a[0] === AT_BREA);
    assert.ok(attack);
    initRng(1n);
    const result = await breatheFromMonster(dragon, target, { attack });
    assert.equal(result.heroDied, false);
    assert.equal(target.mhp, health);
});
//# sourceMappingURL=swallowed_breath.test.js.map