// C mcastu.c:buzzmu(). Ranged spell rays are one original attack slot.
import { heroIsDisplaced } from './armor.js';
import { castMonsterSpellRay } from './breath_ray.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { M_AP_OBJECT, M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { finishHeroDeath } from './end.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { AD_MAGM, AD_SPC2 } from './monster_attack_types.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { seenResistanceForDamage } from './monster_perception.js';
import { monsterLinedUpWithPerceivedHero } from './monmove.js';
import { d, rn2, rnd } from './rng.js';
import { displayRayName } from './ray_name.js';
import { heroIsDeaf } from './senses.js';
import { couldsee } from './vision.js';
const M1_SEE_INVIS = 0x01000000;
const STRANGE_OBJECT = 0;
async function curseDirectedSpell(monster, state, publish, random) {
    if (canSeeMonster(monster)
        && couldsee(monster.mx, monster.my)) {
        const misplaced = monster.mux !== state.u.ux || monster.muy !== state.u.uy;
        const mimicking = state.u.m_ap_type === M_AP_OBJECT
            && state.u.mappearance === STRANGE_OBJECT;
        let pointing = 'at you, then curses';
        if ((heroIsInvisible(state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS)
            && misplaced) || mimicking || state.u.uundetected) {
            pointing = 'and curses in your general direction';
        }
        else if (heroIsDisplaced(state) && misplaced) {
            pointing = 'and curses at your displaced image';
        }
        await publish(`${monsterName(monster, { state, capitalized: true })} points ${pointing}.`);
    }
    else if (!(state.moves % 4) || !random(4)) {
        const message = 'You hear a mumbled curse.';
        if (!heroIsDeaf(state))
            await publish(message, { noRepeat: true });
    }
}
export async function resolveMonsterMagicRay(monster, attack, { state = game, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, calls = [], die = finishHeroDeath, } = {}) {
    requirePlayingGame(state);
    const damageType = attack[1];
    if (damageType < AD_MAGM || damageType > AD_SPC2)
        return { mask: M_ATTK_MISS, heroDied: false };
    if (monster.mcan || ((monster.seen_resistance || 0) & seenResistanceForDamage(damageType))) {
        await curseDirectedSpell(monster, state, publish, random);
        return { mask: M_ATTK_MISS, heroDied: false };
    }
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls) || !random(3))
        return { mask: M_ATTK_MISS, heroDied: false };
    endVoluntaryMultiTurn(state);
    if (canSeeMonster(monster)) {
        await publish(`${monsterName(monster, { state, capitalized: true })} zaps you with a ${displayRayName(damageType, 'wand', { state, random })}!`);
    }
    const dx = Math.sign((monster.mux ?? state.u.ux) - monster.mx);
    const dy = Math.sign((monster.muy ?? state.u.uy) - monster.my);
    const direction = [['y', 'k', 'u'], ['h', null, 'l'], ['b', 'j', 'n']][dy + 1]?.[dx + 1];
    if (!direction)
        return { mask: M_ATTK_HIT, heroDied: false };
    const result = await castMonsterSpellRay(direction, monster.mx, monster.my, attack, {
        state, sourceMonster: monster, publish, random, rollDice, rollOne, die,
    });
    return { mask: M_ATTK_HIT, heroDied: result.heroDied };
}
//# sourceMappingURL=monster_magic_ray.js.map