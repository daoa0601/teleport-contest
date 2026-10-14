import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { resetInputState } from '../js/input.js';
import { ensureHeroSkills } from '../js/skills.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { withMessagePages } from './support/planned-input.js';
for (const name of ['Fire Brand', 'Frost Brand']) {
    void test(`${name} invokes an expert storm without spending energy or training spell skill`, async () => {
        freshObjectRoom({ left: 5, right: 25, top: 5, bottom: 15,
            hero: { uhp: 500, uhpmax: 500, uen: 0, uenmax: 0 },
            flags: { verbose: true, tips: false }, gameplaySeed: 17n });
        requirePlayingGame(game);
        const sword = await artifactObject(name, { invlet: 'a', where: 'inventory', age: 0 });
        game.inventory = [sword];
        const jackal = await createMonsterAt('jackal', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        jackal.mhp = jackal.mhpmax = 500;
        jackal.msleeping = 0;
        const attackSkill = ensureHeroSkills(game)?.[28];
        assert.ok(attackSkill);
        const skill = attackSkill.skill;
        const practice = attackSkill.advance;
        const input = resetInputState();
        await withMessagePages(() => invokeInventoryObject(sword, 'llll.'), input, /^(?:Boom!|The jackal is caught in the (?:fireball|ball of cold)!|\s)+$/, 9);
        assert.ok(jackal.mhp < 500);
        assert.equal(game.u.uen, 0);
        assert.equal(attackSkill.skill, skill);
        assert.equal(attackSkill.advance, practice);
        assert.ok(sword.age > game.moves);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=artifact_invoke_storm.test.js.map