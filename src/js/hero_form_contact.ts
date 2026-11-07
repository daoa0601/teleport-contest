// Native mhitu.c:could_seduce() and mhitm.c:failed_grab() hero-side
// helpers; weapon.c:silver_sears() lives in weapon.ts with its C owner.
import { W_AMUL } from './const.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { AD_DGST, AD_STCK, AD_WRAP, AT_HUGS } from './monster_attack_types.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { OBJECT_NAMES } from './object_data.js';

import { could_seduce } from './seduction_compatibility.js';
import type { MessagePublisher } from './pline.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { AttackTuple } from './monster_action_types.js';
import type { Monster } from './monster_types.js';
import { monsterHasHead, monsterIsBreathless, monsterIsMindless, monsterIsUnsolid } from './mondata.js';


const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');

// Part of C mhitu.c:could_seduce(): the hero-perspective call (the shared
// port is could_seduce() in seduction_compatibility.ts).
export function heroSeductionCompatibility(
    monster: Monster, attack: AttackTuple, state: GameState = game,
): 0 | 1 | 2 {
    return could_seduce('hero', monster, attack, state);
}

// Part of C mhitm.c:failed_grab(): the magr == &gy.youmonst branch —
// unsolid or notonhead targets defeat hug/wrap/stick/digest grabs.
export async function heroGrabMisses(
    monster: Monster, attack: AttackTuple, target: Position,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState; publish?: MessagePublisher;
    } = {},
): Promise<boolean> {
    const tail = monster.mx !== target.x || monster.my !== target.y;
    if ((!tail && !monsterIsUnsolid(monster))
        || !(attack[0] === AT_HUGS || [AD_WRAP, AD_STCK, AD_DGST].includes(attack[1])))
        return false;
    const verb = attack[1] === AD_DGST ? 'gulp' : attack[1] === AD_STCK ? 'adhere' : 'grab';
    const name = monsterName(monster, { state, augmentIt: tail });
    const object = tail ? `${possessiveName(name)} tail` : name;
    await publish(`Your ${verb} attempt ${tail ? 'fails to hold' : 'passes right through'} ${object}!`);
    return true;
}

// Part of C mondata.c:can_be_strangled(): the shared port is in mondata.ts.
export function monsterCanBeStrangled(monster: Monster): boolean {
    if (!monsterHasHead(monster)) return false;
    const nonbreathing = monsterIsBreathless(monster.mnum)
        || (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_MAGICAL_BREATHING
            && !!((object.owornmask ?? 0) & W_AMUL));
    return !monsterIsMindless(monster.mnum) || !nonbreathing;
}
