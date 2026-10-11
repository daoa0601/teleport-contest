// C apply.c:use_camera(), do_blinding_ray(); zap.c self-camera branch.
import { MM_NOMSG } from './const.js';
import { monsterStomachName } from './body_parts.js';
import {
    canSpotMonster,
    plineWithContinuation as pline,
    randomDisplayMonsterName,
} from './display.js';
import { makemonAt } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { doBlindingRay } from './flash.js';
import { game, requireLiveGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import { lightDamage } from './light.js';
import { monsterName, possessiveName } from './monster_name.js';
import { rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { chargeUnpaidUsage } from './shk.js';
import { flashBurn } from './sight_change.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { promptDirection } from './tty_prompts.js';

export async function useCamera(
    object: GameObject,
    { state = game }: { state?: GameState } = {},
): Promise<{ spentTime: boolean; heroDied: boolean; object: GameObject }> {
    requireLiveGame(state);
    const result = { spentTime: false, heroDied: false, object };
    if (state.u.uinwater || state.underwater) {
        await pline('Using your camera underwater would void the warranty.');
        return result;
    }
    const direction = await promptDirection();
    if (!direction) return result;
    result.spentTime = true;
    if (object.spe <= 0) {
        await pline('Nothing happens.');
        return result;
    }
    await chargeUnpaidUsage(object, { state });
    object.spe--;
    const selfFlash = object.cursed && !rn2(2);
    if (selfFlash || (!state.u.uswallow && !direction.dz && !direction.dx && !direction.dy)) {
        const damage = await lightDamage(object, true, 5, { state });
        if (!state.program_state.gameover) await flashBurn(damage + rnd(25), false, { state });
    } else if (state.u.uswallow) {
        const holder = state.u.ustuck;
        if (!holder) throw new Error('Swallowed camera use requires a holder');
        await pline(
            `You take a picture of ${possessiveName(monsterName(holder))} ${monsterStomachName(holder.mnum)}.`,
        );
    } else if (direction.dz) {
        await pline(
            `You take a picture of the ${
                direction.dz > 0
                    ? surfaceName(state.u.ux, state.u.uy, state)
                    : ceilingName(state.u.ux, state.u.uy, state)
            }.`,
        );
    } else {
        result.heroDied = await doBlindingRay(object, direction, { state });
    }
    result.heroDied ||= !!state.program_state.gameover;
    return result;
}

const PM_HOMUNCULUS = 52;
const PM_IMP = 53;

export async function releaseCameraDemon(
    object: GameObject,
    x: number,
    y: number,
    {
        state = game,
        publish = pline,
        random = rn2,
        summonMonster = makemonAt,
    }: {
        state?: GameState;
        publish?: MessagePublisher;
        random?: typeof rn2;
        summonMonster?: typeof makemonAt;
    } = {},
): Promise<Monster | null> {
    if (random(3) !== 0) return null;
    const mnum = random(3) === 0 ? PM_IMP : PM_HOMUNCULUS;
    const monster = await summonMonster(mnum, x, y, MM_NOMSG);
    if (!monster) return null;

    if (canSpotMonster(monster)) {
        const subject = heroIsHallucinating(state)
            ? `A ${randomDisplayMonsterName()}`
            : 'The picture-painting demon';
        await publish(`${subject} is released!`);
    }
    monster.mpeaceful = object.cursed ? 0 : 1;
    setMonsterMalign(monster, state);
    return monster;
}
