import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, SICK_NONVOMITABLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const resistance of [false, true]) {
    for (const cancelled of [false, true]) {
        void test(`Scorpius's ${cancelled ? 'cancelled' : 'ordinary'} sting ${resistance ? 'respects sickness resistance' : 'causes disease and contact damage'}`, async () => {
            freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, sicknessResistance: resistance } });
            requirePlayingGame(game);
            const scorpion = await createMonsterAt('Scorpius', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            scorpion.mux = game.u.ux;
            scorpion.muy = game.u.uy;
            scorpion.mcan = cancelled;
            const input = resetInputState();
            const messages = [];
            input.beforeRead = () => { messages.push(game._pending_message); };
            installPagerInput(input, { expected: /Scorpius|sick|illness/, limit: 12 });
            await performMonsterHeroAttack(scorpion, game, {
                random: range => range - 1, rollOne: () => 1,
                rollDice: (count, sides) => count * sides,
            });
            assert.equal(game.u.uhp, resistance ? 76 : 72, 'Resistance removes the sting damage, while both claws still hurt');
            assert.equal(!!game.u.sick, !resistance);
            const prose = [...messages, game._pending_message].join('\n');
            if (resistance)
                assert.match(prose, /You feel a slight illness\./);
            else {
                assert.equal(game.u.sickCause, 'Scorpius');
                assert.equal(game.u.sickType, SICK_NONVOMITABLE);
                assert.ok((game.u.sickTurns ?? 0) >= 20);
                assert.match(prose, /Scorpius stings!.*You feel deathly sick\./s);
            }
        });
    }
}
void test('a disease sting shortens existing sickness and records its new cause', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10,
            sick: true, sickTurns: 30, sickType: SICK_NONVOMITABLE, sickCause: 'old illness' } });
    requirePlayingGame(game);
    const scorpion = await createMonsterAt('Scorpius', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    scorpion.mux = game.u.ux;
    scorpion.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /Scorpius|worse/, limit: 12 });
    await performMonsterHeroAttack(scorpion, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: count => count,
    });
    assert.equal(game.u.sickTurns, 11);
    assert.equal(game.u.sickCause, 'Scorpius');
});
//# sourceMappingURL=monster_hero_disease.test.js.map