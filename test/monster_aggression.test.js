import test from 'node:test';
import assert from 'node:assert/strict';

import { runClaimedCorpseRevivalTimer } from '../js/corpse_revival.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    finishDeferredMonsterDeath, quietMonsterActionRng,
    resumeDeferredMonsterContact,
} from '../js/monmove.js';
import { CORPSE } from '../js/object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { addMonster, addPet } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_GIANT = 169;
const PM_HUMAN_ZOMBIE = 244;
const PM_GIANT_ZOMBIE = 247;

function freshState() {
    freshObjectRoom({
        heroX: 13,
        heroY: 10,
        objectInitializationSeed: 700n,
        recalculateVision: false,
    });
}

function addArenaMonster(options) {
    return addMonster({
        mux: game.u.ux, muy: game.u.uy,
        movement: 12,
        ...options,
    });
}

test('a zombie attacks a nearby giant and the giant rises as a zombie',
    async () => {
        freshState();
        const zombie = addArenaMonster({
            m_id: 901,
            mnum: PM_HUMAN_ZOMBIE,
            x: 10, y: 10,
            hitPoints: 30,
            level: 8,
        });
        const giant = addArenaMonster({
            m_id: 902,
            mnum: PM_GIANT,
            x: 11, y: 10,
            hitPoints: 8,
            level: 6,
        });
        giant.name = 'Bram';
        game._deferVisibleMonsterContact = true;

        const action = quietMonsterActionRng(
            zombie, game,
            () => 0,
            () => 20,
            () => 1,
        );
        resumeDeferredMonsterContact(
            action, game, () => 0, () => 20, () => 1,
        );
        await finishDeferredMonsterDeath(action, game, {
            random: () => 0,
            rollOne: () => 1,
            publish: async () => {},
        });

        assert.equal(game.level.monsters.includes(giant), false);
        assert.deepEqual([zombie.mx, zombie.my], [10, 10]);
        const corpse = game.level.objects[11][10].find(
            object => object.otyp === CORPSE,
        );
        const [timer] = objectTimers(corpse);
        assert.equal(timer.kind, OBJECT_TIMER_KIND.ZOMBIFY_MON);

        game.moves = timer.deadline;
        const event = await runClaimedCorpseRevivalTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.monster.mnum, PM_GIANT_ZOMBIE);
        assert.equal(event.monster.name, giant.name);
    });

test('a fatal monster attack makes a shifted vampire rise', async () => {
    freshState();
    const dragon = addPet({
        species: 'red dragon', x: 10, y: 10,
        hitPoints: 40, level: 15, movement: 12,
        mux: game.u.ux, muy: game.u.uy,
        edog: { hungrytime: 1000 },
    });
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = addArenaMonster({
        species: 'wolf', x: 11, y: 10,
        hitPoints: 1, maxHitPoints: 20, level: 6,
        cham: vampireLeader,
    });
    game._deferVisibleMonsterContact = true;

    const action = quietMonsterActionRng(
        dragon, game, () => 0, () => 20, () => 1,
    );
    resumeDeferredMonsterContact(
        action, game, () => 0, () => 20, () => 1,
    );
    await finishDeferredMonsterDeath(action, game, {
        random: () => 0,
        rollOne: () => 1,
        publish: async () => {},
    });

    assert.equal(wolf.mnum, vampireLeader);
    assert.equal(wolf.mhp > 0, true);
    assert.equal(game.level.monsters.includes(wolf), true);
});
