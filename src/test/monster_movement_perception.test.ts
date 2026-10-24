import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { D_LOCKED, DOOR, G_GENOD, MM_ANGRY, NO_MINVENT, TELEP_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { mfndpos, takeMonsterTurn } from '../js/monmove.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { monsterLearnsTrap } from '../js/trap_knowledge.js';
import { initTrack } from '../js/track.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const RIN_STEALTH = OBJECT_NAMES.indexOf('stealth');

for (const ringSlot of [null, 'inventory', 'uleft', 'uright'] satisfies (null | 'inventory' | 'uleft' | 'uright')[]) {
    void test(`fixed teleport tracks respect a stealth ring ${ringSlot || 'not present'}`, async () => {
        const level = freshObjectRoom({ heroX: 10, heroY: 10 });
        requirePlayingGame(game);
        initTrack(game);
        if (ringSlot) {
            const ring = await addInventoryObject(RIN_STEALTH);
            if (ringSlot !== 'inventory') await wearHeroAccessory(ring, ringSlot);
        }
        const trap = addTrap(level, TELEP_TRAP, 11, 10, { teledest: { x: 14, y: 10 } });
        pushKeys(' '.repeat(100));

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [14, 10]);
        const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
        monsterLearnsTrap(goblin, trap);
        assert.equal((await mfndpos(goblin, game)).some(square => square.x === 11 && square.y === 10),
            !ringSlot || ringSlot === 'inventory');
    });
}

for (const blockedBy of ['fog genocide', 'protection from shape changers']) {
    void test(`a vampire cannot fog under a locked door with ${blockedBy}`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        requirePlayingGame(game);
        const wolf = await createMonsterAt('wolf', 10, 10, MM_ANGRY | NO_MINVENT);
        wolf.cham = MONSTER_NAME.indexOf('vampire');
        const location = level.requireAt(11, 10);
        location.typ = DOOR;
        location.doormask = D_LOCKED;
        const canPass = async () => {
            requirePlayingGame(game);
            return (await mfndpos(wolf, game)).some(square => square.x === 11 && square.y === 10);
        };
        assert.equal(await canPass(), true);

        if (blockedBy === 'fog genocide') {
            assert.ok(game.mvitals);
            game.mvitals[MONSTER_NAME.indexOf('fog cloud')] = { born: 0, died: 0, mvflags: G_GENOD };
        } else game.u.protectionFromShapeChangers = true;

        assert.equal(await canPass(), false);
    });
}

void test('a xorn locates an invisible gold carrier for its adjacent attack', async () => {
    let noGoldMisses = 0;
    for (let seed = 1; seed <= 8; seed++) {
        for (const gold of [0, 100]) {
            freshObjectRoom({ heroX: 10, heroY: 10,
                hero: { invisibleTurns: 50, uhp: 200, uhpmax: 200, uac: 100 } });
            requirePlayingGame(game);
            setHeroGoldAmount(game, gold);
            const xorn = await createMonsterAt('xorn', 11, 10, MM_ANGRY | NO_MINVENT);
            xorn.mux = 0;
            xorn.muy = 0;
            xorn.msleeping = 0;
            pushKeys(' '.repeat(100));
            initRng(BigInt(seed));

            await takeMonsterTurn(xorn, game);

            if (gold) assert.ok(game.u.uhp < 200, `gold scent locates the hero in game ${seed}`);
            else if (game.u.uhp === 200) noGoldMisses++;
        }
    }
    assert.ok(noGoldMisses > 0, 'without gold, an invisible hero can still mislead a xorn');
});
