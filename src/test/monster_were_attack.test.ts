import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function attacker() {
    const level = freshObjectRoom({ gameplaySeed: 314 });
    requirePlayingGame(game);
    const monster = await createMonsterAt(263, 11, 10, NO_MINVENT);
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    monster.mpeaceful = 0;
    monster.mhp = 4;
    monster.mhpmax = 20;
    game.u.invulnerable = true;
    game._prayerTurnsRemaining = 2;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return { level, monster };
}

void test('an attacking human werewolf transforms, heals, and calls wild wolves before respecting prayer', async () => {
    const { level, monster } = await attacker();
    requirePlayingGame(game);

    await performMonsterHeroAttack(monster, game, { random: () => 0 });

    assert.equal(monster.mnum, 21);
    assert.equal(monster.mhp, 8);
    const helpers = level.monsters.filter(other => other !== monster);
    assert.ok(helpers.length >= 1 && helpers.length <= 5);
    assert.ok(helpers.every(other =>
        ['wolf', 'warg', 'winter wolf'].includes(MONSTER_NAME[other.mnum] ?? '')));
    assert.ok(helpers.every(other => !other.mtame));
});

for (const reason of ['cancelled', 'shapechanger', 'distant-image'] as const) {
    void test(`a werewolf with ${reason} does not transform or summon during its attack`, async () => {
        const { level, monster } = await attacker();
        requirePlayingGame(game);
        if (reason === 'cancelled') monster.mcan = 1;
        if (reason === 'shapechanger') monster.cham = 263;
        if (reason === 'distant-image') monster.mux = monster.mx + 4;

        await performMonsterHeroAttack(monster, game, { random: () => 0 });

        assert.equal(monster.mnum, 263);
        assert.equal(level.monsters.length, 1);
    });
}
