import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { DOOR, D_CLOSED, D_NODOOR, D_TRAPPED, NO_MINVENT, PIT } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKillOutcome } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { AMULET_OF_LIFE_SAVING, CORPSE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap, floorObjectQuantityAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const lifeSaved of [false, true]) {
    void test(`vampire recovery ${lifeSaved ? 'continues after life saving on expulsion' : 'stops when expulsion kills the hero'}`, async () => {
        const level = freshObjectRoom({
            gameplaySeed: 37n,
            hero: { uhp: 1, uhpmax: 40 },
            flags: { disclose: '-i -a -v -c -o' },
        });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        const amulet = lifeSaved
            ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet)
            await wearHeroAccessory(amulet, 'uamul');
        const fogCloud = MONSTER_NAME.indexOf('fog cloud');
        const vampire = MONSTER_NAME.indexOf('vampire');
        const monster = await createMonsterAt(fogCloud, 11, 10, NO_MINVENT);
        monster.cham = vampire;
        monster.mx = game.u.ux;
        monster.my = game.u.uy;
        game.u.ustuck = monster;
        game.u.uswallow = game.uswallow = 1;
        addTrap(level, PIT, game.u.ux, game.u.uy);
        const input = resetInputState();
        installPagerInput(input, {
            expected: /amulet of life saving \(being worn\)|fog cloud|vampire|pit|You die|But wait|medallion|feel much better|REST|PEACE|points/,
            limit: 12,
        });
        const death = await finishMonsterKilled(monster, game, { damageType: AD_PHYS });
        assert.equal(!!death.heroDied, !lifeSaved);
        assert.equal(!!game.program_state.gameover, !lifeSaved);
        assert.equal(game.u.uswallow, 0);
        assert.equal(game.u.ustuck, null);
        assert.equal(game.u.umortality, 1);
        assert.equal(death.survived, true);
        assert.equal(level.monsters.includes(monster), true);
        assert.equal(monster.mnum, lifeSaved ? vampire : fogCloud, 'Only a surviving hero can see vampire recovery continue after the landing.');
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(game.u.uhp > 0);
        }
        else {
            assert.equal(game._deathKiller, 'fell into a pit');
        }
    });
}
for (const disintegrated of [false, true]) {
    void test(`a vampire killed by its recovery door ${disintegrated ? 'can leave a corpse after disintegration' : 'gets both native corpse chances but only one recorded death'}`, async () => {
        const { level, monster, door, messages, publish } = await vampireInTrappedDoor();
        // A low-health natural form cannot survive this door's ordinary blast.
        initRng(27471n);
        const death = await finishMonsterKilled(monster, game, {
            damageType: disintegrated ? 'disintegration' : AD_PHYS,
            cause: null,
            random: () => 0,
            publish,
        });
        assert.equal(death.survived, false);
        assert.equal(monster.dead, true);
        assert.notEqual(monsterAtPosition(level, monster.mx, monster.my), monster);
        assert.equal(requireMonsterVital(monster.mnum).died, 1);
        assert.equal(floorObjectQuantityAt(level, 11, 10, CORPSE), disintegrated ? 1 : 2);
        assert.equal(death.corpse?.otyp, CORPSE);
        assert.equal(door.doormask, D_NODOOR);
        assert.match(messages.join('\n'), /rises as a vampire.*\n.*door is smashed.*\n.*vampire is destroyed/s);
        assert.doesNotMatch(messages.join('\n'), /sad feeling|KABOOM/, 'The original attack recovered; the door death does not inherit its pet grief.');
        assert.equal(game.flags.verbose, true);
    });
}
void test('a hero-credited disintegration still credits a vampire killed by its recovery door once', async () => {
    const { level, monster, door } = await vampireInTrappedDoor();
    requirePlayingGame(game);
    initRng(27471n);
    const death = await finishHeroMonsterKillOutcome(monster, 11, 10, { noCorpse: true });
    assert.equal(death.killed, true);
    assert.equal(death.heroDied, false);
    assert.equal(requireMonsterVital(monster.mnum).died, 1);
    assert.equal(floorObjectQuantityAt(level, 11, 10, CORPSE), 1);
    assert.equal(game.u.uconduct.killer, 1);
    assert.ok(game.u.uexp > 0);
    assert.equal(game.u.ulevel, 2);
    assert.equal(monster.edog?.killed_by_u, 1);
    assert.notEqual(monsterAtPosition(level, monster.mx, monster.my), monster);
    assert.equal(door.doormask, D_NODOOR);
    assert.equal(game.flags.verbose, true);
});
void test('a vampire which survives its recovery door learns the trap and stays alive', async () => {
    const { level, monster, door, messages, publish } = await vampireInTrappedDoor();
    initRng(37n);
    const death = await finishMonsterKilled(monster, game, { damageType: AD_PHYS, publish });
    assert.equal(death.survived, true);
    assert.ok(monster.mhp > 0);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(level.monsters.includes(monster), true);
    assert.equal(requireMonsterVital(monster.mnum).died, 0);
    assert.equal(floorObjectQuantityAt(level, 11, 10, CORPSE), 0);
    assert.ok(monster.mstun);
    assert.ok(monster.mtrapseen);
    assert.equal(door.doormask, D_NODOOR);
    assert.doesNotMatch(messages.join('\n'), /sad feeling|KABOOM/);
    assert.equal(game.flags.verbose, true);
});
async function vampireInTrappedDoor() {
    const level = freshObjectRoom({
        hero: { ulevel: 1, uz: { dnum: 0, dlevel: 1 } },
        flags: { verbose: true },
    });
    const monster = await createMonsterAt('fog cloud', 11, 10, NO_MINVENT);
    monster.cham = MONSTER_NAME.indexOf('vampire');
    initializePet(monster);
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED | D_TRAPPED;
    const messages = [];
    installPagerInput(resetInputState(), {
        expected: /fog cloud|vampire|door|sad feeling|KABOOM|Welcome to experience level 2\./,
        limit: 8,
    });
    const publish = async (message) => {
        messages.push(message);
        await plineWithContinuation(message);
    };
    return { level, monster, door, messages, publish };
}
//# sourceMappingURL=monster_recovery_death.test.js.map