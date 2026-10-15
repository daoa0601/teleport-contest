import { moveloop_core } from '../../js/allmain.js';
import { MM_NOWAIT, NO_MINVENT } from '../../js/const.js';
import { game, requirePlayingGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { initRng } from '../../js/rng.js';
import { createMonsterAt } from './monsters.js';
import { freshObjectRoom } from './object-room.js';
import { finishAtCommandInput, installPagerInput } from './pager-input.js';

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
    input.feed('m.');
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /^/);
    return messages.join('\n');
}
