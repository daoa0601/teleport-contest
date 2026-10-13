import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const protection of ['none', 'free action', 'cancelled attacker', 'already helpless']) {
    void test(`a cube touch deals damage with ${protection}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const cube = await createMonsterAt('gelatinous cube', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        cube.mux = game.u.ux;
        cube.muy = game.u.uy;
        cube.mcan = protection === 'cancelled attacker' ? 1 : 0;
        game.u.freeAction = protection === 'free action';
        if (protection === 'already helpless') game._helplessTurns = 7;
        const input = resetInputState();
        const messages: string[] = [];
        installPagerInput(input, { expected: /cube|stiffen|frozen/, limit: 8 });
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(cube, game, {
            random: limit => limit === 3 ? 0 : limit - 1,
            rollOne: sides => sides === 10 ? 4 : 1, rollDice: () => 3,
        });
        await flushPendingTopline();

        assert.equal(game.u.uhp, 97, 'paralysis prevention never prevents physical damage');
        assert.equal(game._helplessTurns ?? 0, protection === 'none' ? 4 : protection === 'already helpless' ? 7 : 0);
        const text = messages.join('\n');
        if (protection === 'none') assert.match(text, /You are frozen by the gelatinous cube!/);
        else if (protection === 'free action') assert.match(text, /You momentarily stiffen\./);
        else assert.doesNotMatch(text, /frozen|stiffen/);
    });
}
