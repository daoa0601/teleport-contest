import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { M_AP_MONSTER, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { castChainLightning } from '../js/spell_attack_effects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';

for (const condition of ['visible', 'distant', 'hallucinating', 'blind', 'hidden-telepathic', 'disguised'] as const) {
    void test(`a timed action records nearby monster species when ${condition}`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('goblin', condition === 'distant' ? 14 : 11, 10, NO_MINVENT);
        monster.mcanmove = 0;
        monster.mfrozen = 100;
        if (condition === 'hallucinating') setPropertyTimeout('hallucination', 100);
        if (condition === 'blind' || condition === 'hidden-telepathic') setHeroBlindnessTurns(100);
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
        game.bhitpos = { x: 14, y: 12 };
        game.notonhead = true;

        await finishAtCommandInput(input, moveloop_core, /^$/);

        const observed = ['visible', 'hidden-telepathic', 'disguised'].includes(condition);
        assert.equal(!!game.mvitals?.[apparentSpecies]?.seen_close, observed);
        assert.equal(game.context.lifelist?.total_seen_upclose ?? 0, Number(observed));
        assert.equal(game.bhitpos.x, observed ? monster.mx : 14);
        assert.equal(game.bhitpos.y, observed ? monster.my : 12);
        assert.equal(game.notonhead, !observed);
        if (condition === 'disguised') assert.equal(game.mvitals?.[monster.mnum]?.seen_close ?? 0, 0);
    });
}

for (const nearbyPart of ['head', 'tail'] as const) {
    void test(`a timed action leaves targeting on a newly observed worm ${nearbyPart}`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const worm = await createMonsterAt('long worm', nearbyPart === 'head' ? 11 : 12, 10,
            MM_NOTAIL | NO_MINVENT);
        assertWormBody(worm);
        if (nearbyPart === 'tail') worm.wormSegments = [{ x: 11, y: 10 }];
        worm.mcanmove = 0;
        worm.mfrozen = 100;
        installPagerInput(input, { expected: /^$/, limit: 1 });
        input.feed('m.');
        await moveloop_core();
        game.bhitpos = { x: 14, y: 12 };
        game.notonhead = nearbyPart === 'head';

        await finishAtCommandInput(input, moveloop_core, /^$/);

        const species = nearbyPart === 'head' ? worm.mnum : MONSTER_NAME.indexOf('long worm tail');
        assert.equal(game.mvitals?.[species]?.seen_close, 1);
        assert.equal(game.bhitpos.x, 11);
        assert.equal(game.bhitpos.y, 10);
        assert.equal(game.notonhead, nearbyPart === 'tail');
    });
}

void test('observing a nearby monster lets chain lightning mark its head after it turns invisible', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    monster.mcanmove = 0;
    monster.mfrozen = 100;
    monster.mhp = monster.mhpmax = 500;
    installPagerInput(input, { expected: /^$/, limit: 1 });
    input.feed('m.');
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /^$/);
    monster.minvis = 1;
    newsym(monster.mx, monster.my);
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'invisible');

    await castChainLightning();

    assert.ok(monster.mhp < 500);
    assert.equal(glyphAt(monster.mx, monster.my)?.kind, 'invisible');
});
