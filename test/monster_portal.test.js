import test from 'node:test';
import assert from 'node:assert/strict';
import { MAGIC_PORTAL, MIGR_PORTAL, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { AMULET_OF_YENDOR, LEASH } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterLearnsTrap } from '../js/trap_knowledge.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
async function portalMonster(species = 'little dog') {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 12, 10, NO_MINVENT);
    const trap = addTrap(game.level, MAGIC_PORTAL, 12, 10, {
        dst: { dnum: 0, dlevel: 9 },
    });
    return { monster, trap };
}
void test('an unleashed pet enters a magic portal and retains its tameness', async () => {
    const { monster: pet, trap } = await portalMonster();
    requirePlayingGame(game);
    initializePet(pet);
    const tameness = pet.mtame;
    const messages = [];
    await triggerImmediateMonsterTrap(pet, game, {
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(game.level.monsters.includes(pet), false);
    assert.equal(pet.mtame, tameness);
    assert.deepEqual(pet.migrationDestination, trap.dst);
    assert.equal(pet.migrationMode, MIGR_PORTAL);
    assert.equal(pet.mconf, 1);
    assert.ok(messages.includes('Suddenly, the little dog disappears out of sight.'));
    assert.equal(trap.tseen, true);
});
for (const cursed of [false, true]) {
    void test(`a magic portal ${cursed ? 'cannot pull a pet out of a cursed leash' : 'releases an uncursed leash before sending the pet away'}`, async () => {
        const { monster: pet } = await portalMonster();
        requirePlayingGame(game);
        initializePet(pet);
        const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id, cursed });
        pet.mleashed = 1;
        const messages = [];
        await triggerImmediateMonsterTrap(pet, game, {
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(pet.mleashed, cursed ? 1 : 0);
        assert.equal(leash.leashmon, cursed ? pet.m_id : 0);
        assert.equal(game.level.monsters.includes(pet), cursed);
        if (!cursed)
            assert.ok(messages.includes('Your leash goes slack.'));
    });
}
for (const held of [false, true]) {
    void test(`a magic portal leaves the hero's ${held ? 'grabber' : 'steed'} on the level`, async () => {
        const { monster } = await portalMonster(held ? 'owlbear' : 'pony');
        requirePlayingGame(game);
        if (held)
            game.u.ustuck = monster;
        else
            game.u.usteed = monster;
        const action = await triggerImmediateMonsterTrap(monster, game, { publish: async () => { } });
        assert.equal(action.event, null);
        assert.ok(game.level.monsters.includes(monster));
    });
}
void test('a monster with teleport control crosses a portal without becoming confused', async () => {
    const { monster } = await portalMonster('tengu');
    requirePlayingGame(game);
    monster.mconf = 0;
    await triggerImmediateMonsterTrap(monster, game, { publish: async () => { } });
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(monster.mconf, 0);
});
void test('a monster can avoid a magic portal it already knows about', async () => {
    const { monster, trap } = await portalMonster('goblin');
    requirePlayingGame(game);
    monsterLearnsTrap(monster, trap);
    const action = await triggerImmediateMonsterTrap(monster, game, {
        random: () => 1, publish: async () => { },
    });
    assert.equal(action.event?.kind, 'known-trap-avoided');
    assert.ok(game.level.monsters.includes(monster));
});
void test('forcing a pet into a portal releases even a cursed leash', async () => {
    const { monster: pet } = await portalMonster();
    requirePlayingGame(game);
    initializePet(pet);
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id, cursed: true });
    pet.mleashed = 1;
    await triggerImmediateMonsterTrap(pet, game, { force: true, publish: async () => { } });
    assert.equal(pet.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(game.level.monsters.includes(pet), false);
});
void test('portal departure waits for the message pager before removing the pet', async () => {
    const { monster: pet } = await portalMonster();
    requirePlayingGame(game);
    initializePet(pet);
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();
    const departure = triggerImmediateMonsterTrap(pet, game);
    await input.waitUntilBlocked();
    try {
        assert.ok(game.level.monsters.includes(pet));
        assert.equal(pet.mx, 12);
        assert.equal(pet.my, 10);
    }
    finally {
        input.feed(' '.repeat(20));
        await departure;
    }
    assert.equal(game.level.monsters.includes(pet), false);
});
for (const roll of [0, 1]) {
    void test(`a monster ${roll === 0 ? 'passes' : 'shimmers at'} a planar portal on the native random chance`, async () => {
        const { monster, trap } = await portalMonster('goblin');
        requirePlayingGame(game);
        game.astral_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
        const messages = [];
        await triggerImmediateMonsterTrap(monster, game, {
            random: () => roll,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(game.level.monsters.includes(monster), roll !== 0);
        assert.equal(trap.tseen, true);
        if (roll !== 0)
            assert.ok(messages.includes('The goblin seems to shimmer for a moment.'));
    });
}
void test('an Amulet carrier cannot cross a planar portal', async () => {
    const { monster } = await portalMonster('goblin');
    requirePlayingGame(game);
    game.astral_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    await addObjectToMonsterInventory(monster, await knownObject(AMULET_OF_YENDOR));
    await triggerImmediateMonsterTrap(monster, game, {
        random: () => 0, publish: async () => { },
    });
    assert.ok(game.level.monsters.includes(monster));
});
void test('a home elemental cannot leave its plane through a portal', async () => {
    const { monster, trap } = await portalMonster('earth elemental');
    requirePlayingGame(game);
    game.astral_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.earth_level = createSpecialLevel({ ...game.u.uz });
    const messages = [];
    await triggerImmediateMonsterTrap(monster, game, {
        random: () => 0, publish: async (message) => { messages.push(message); },
    });
    assert.ok(game.level.monsters.includes(monster));
    assert.equal(trap.tseen, false);
    assert.equal(messages.length, 0);
});
//# sourceMappingURL=monster_portal.test.js.map