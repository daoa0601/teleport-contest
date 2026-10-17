import assert from 'node:assert/strict';
import test from 'node:test';
import { moveMonsterForHeroAttack } from '../js/allmain.js';
import { FIRE_TRAP, MMOVE_MOVED, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { monsterName } from '../js/monster_name.js';
import { initRng } from '../js/rng.js';
import { pushKeys } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const alreadySeen of [false, true]) {
    void test(`a fire-resistant monster keeps its arrival hallucination after crossing a ${alreadySeen ? 'known' : 'new'} fire trap`, async () => {
        const level = freshObjectRoom({
            left: 10, right: 14, top: 10, bottom: 10,
            flags: { sparkle: false },
            hero: { hallucinationTurns: 20 },
        });
        const monster = await createMonsterAt('salamander', 11, 10, MM_ANGRY | NO_MINVENT);
        monster.mflee = 1;
        monster.mfleetim = 20;
        const trap = addTrap(level, FIRE_TRAP, 12, 10, { tseen: alreadySeen });

        initRng(1n);
        monsterName(monster); // The flame announcement names its victim.
        monsterName(monster); // Fire resistance names the uninjured victim.
        if (!alreadySeen) newsym(monster.mx, monster.my);
        newsym(monster.mx, monster.my); // postmov() draws the arriving monster.
        const arrival = glyphAt(monster.mx, monster.my);
        assert.ok(arrival?.kind === 'monster');
        initRng(1n);
        pushKeys(' '.repeat(10));

        const result = await moveMonsterForHeroAttack(monster);

        assert.equal(result.status, MMOVE_MOVED);
        assert.equal(monster.mx, 12);
        assert.equal(monster.my, 10);
        assert.equal(trap.tseen, true);
        const shown = glyphAt(monster.mx, monster.my);
        assert.ok(shown?.kind === 'monster');
        assert.equal(shown.mnum, arrival.mnum, 'finishing the trap must preserve the arrival appearance');
    });
}
