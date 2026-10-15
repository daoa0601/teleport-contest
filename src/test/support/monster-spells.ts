import { moveloop_core } from '../../js/allmain.js';
import { MM_NOWAIT, NO_MINVENT } from '../../js/const.js';
import assert from 'node:assert/strict';
import { game, requireGameDisplay, requirePlayingGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { initRng } from '../../js/rng.js';
import { createMonsterAt } from './monsters.js';
import { freshObjectRoom } from './object-room.js';
import { installPagerInput } from './pager-input.js';

export async function prepareSpellCaster(species: string, level: number) {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000, coldResistance: true } });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    const caster = await createMonsterAt(species, 11, 10, MM_NOWAIT | NO_MINVENT);
    caster.mpeaceful = 0;
    caster.msleeping = 0;
    caster.movement = 12;
    caster.mhp = caster.mhpmax = 100;
    caster.m_lev = level;
    caster.mstrategy = 0;
    return caster;
}

export async function finishSpellTurn(seed: number): Promise<string> {
    game._moveloopStarted = true;
    game.u.umovement = 12;
    initRng(BigInt(seed));
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 80 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (game._pending_message && /--More--|Hit space to continue/.test(screen)) return pager.readKey();
            assert.doesNotMatch(game._pending_message, /\?/, 'A spell turn must not bypass a question');
            return 27;
        },
    };
    const alreadyHelpless = (game._helplessTurns ?? 0) > 0;
    if (alreadyHelpless) game._heroTimePending = true;
    else input.feed('m.');
    await moveloop_core();
    if (!alreadyHelpless) await moveloop_core();
    if (messages.at(-1) !== game._pending_message) messages.push(game._pending_message);
    return messages.join('\n');
}
