import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { M_AP_MONSTER, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
for (const condition of ['visible', 'distant', 'hallucinating', 'blind', 'hidden-telepathic', 'disguised']) {
    void test(`a timed action records nearby monster species when ${condition}`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('goblin', condition === 'distant' ? 14 : 11, 10, NO_MINVENT);
        monster.mcanmove = 0;
        monster.mfrozen = 100;
        if (condition === 'hallucinating')
            setPropertyTimeout('hallucination', 100);
        if (condition === 'blind' || condition === 'hidden-telepathic')
            setHeroBlindnessTurns(100);
        if (condition === 'hidden-telepathic') {
            monster.mundetected = 1;
            grantIntrinsicProperty('telepathy', 'outside');
        }
        const apparentSpecies = condition === 'disguised' ? MONSTER_NAME.indexOf('jackal') : monster.mnum;
        if (condition === 'disguised') {
            monster.m_ap_type = M_AP_MONSTER;
            monster.mappearance = apparentSpecies;
        }
        installPagerInput(input, { expected: /^$/, limit: 1 });
        input.feed('m.');
        await moveloop_core();
        assert.equal(game.mvitals?.[apparentSpecies]?.seen_close ?? 0, 0);
        await finishAtCommandInput(input, moveloop_core, /^$/);
        const observed = ['visible', 'hidden-telepathic', 'disguised'].includes(condition);
        assert.equal(!!game.mvitals?.[apparentSpecies]?.seen_close, observed);
        assert.equal(game.context.lifelist?.total_seen_upclose ?? 0, Number(observed));
        if (condition === 'disguised')
            assert.equal(game.mvitals?.[monster.mnum]?.seen_close ?? 0, 0);
    });
}
//# sourceMappingURL=allmain_observation.test.js.map