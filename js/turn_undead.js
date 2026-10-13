import { requirePlayingGame } from './gstate.js';
// The priest and knight #turn command.
// C ref: pray.c doturn() and maybe_turn_mon_iter().
import { endVoluntaryMultiTurn } from './command_state.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS, BOLT_LIM, MAXULEV, } from './const.js';
import { pline, shieldeff, } from './display.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { game } from './gstate.js';
import { monsterName } from './monster_name.js';
import { cansee } from './vision.js';
import { heroCanChant } from './hero_speech.js';
import { setMonsterMalign } from './monster_alignment.js';
import { aggravateMonsters } from './monster_anger.js';
import { makeMonsterFlee } from './monster_flee.js';
import { MONSTER_FLAGS2, MONSTER_SYMBOL, monsterIsUndead, monsterIsVampireShifter, } from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { rn2 } from './rng.js';
import { couldsee } from './vision.js';
const M2_DEMON = 0x00000100;
const TURN_LEVEL_BY_CLASS = new Map([
    [52, 6], // zombie
    [39, 8], // mummy
    [49, 10], // wraith
    [48, 12], // vampire
    [54, 14], // ghost
    [38, 16], // lich
]);
function deityName(state) {
    const alignment = state.u?.ualign?.type ?? 0;
    if (alignment > 0)
        return state.urole?.gods?.lawful || 'your god';
    if (alignment < 0)
        return state.urole?.gods?.chaotic || 'your god';
    return state.urole?.gods?.neutral || 'your god';
}
function heroIsDemonOrUndead(state) {
    const hero = state.u;
    const flags = MONSTER_FLAGS2[hero.umonnum] ?? 0;
    return !!(flags & M2_DEMON)
        || monsterIsUndead(hero.umonnum)
        || monsterIsVampireShifter({ mnum: hero.umonnum, cham: hero.mcham ?? -1 });
}
function inGehennom(state) {
    const dnum = state.u?.uz?.dnum ?? -1;
    return !!state.dungeons?.[dnum]?.flags.hellish;
}
function eligibleTarget(monster, heroLevel) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
        || monster.mpeaceful)
        return false;
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    return monsterIsUndead(monster.mnum)
        || monsterIsVampireShifter(monster)
        || (heroLevel > MAXULEV / 2 && !!(flags & M2_DEMON));
}
async function turnOneMonster(monster, state, options) {
    const { finishMonsterKill, random } = options;
    const heroLevel = state.u?.ulevel ?? 1;
    monster.msleeping = 0;
    if (state.u?.confused || (state.u?.confusionTurns ?? 0) > 0) {
        monster.mflee = 0;
        monster.mfrozen = 0;
        monster.mcanmove = 1;
        return 'faltered';
    }
    if (monsterResistsEffect(monster, heroLevel, random)) {
        await shieldeff(monster.mx, monster.my, state);
        if (cansee(monster.mx, monster.my))
            await pline(`${monsterName(monster, { state, capitalized: true })} resists!`);
        return 'resisted';
    }
    const requiredLevel = TURN_LEVEL_BY_CLASS.get(MONSTER_SYMBOL[monster.mnum] ?? -1);
    if (requiredLevel != null && heroLevel >= requiredLevel
        && !monsterResistsEffect(monster, heroLevel, random)) {
        if ((state.u?.ualign?.type ?? 0) < 0) {
            monster.mpeaceful = 1;
            setMonsterMalign(monster, state);
        }
        else {
            await finishMonsterKill(monster, monster.mx, monster.my);
        }
        return 'turned';
    }
    const flight = await makeMonsterFlee(monster, { state, random });
    return flight.heroDied ? 'hero-died' : 'fled';
}
export async function turnUndeadByCallingOnDeity(state = game, { finishMonsterKill = finishHeroMonsterKill, random = rn2, } = {}) {
    requirePlayingGame(state);
    if (!state.u.uconduct)
        state.u.uconduct = {};
    const priorCalls = state.u.uconduct.gnostic ?? 0;
    state.u.uconduct.gnostic = priorCalls + 1;
    const deity = deityName(state);
    if (!heroCanChant(state)) {
        const strangled = state.u?.strangled
            || (state.u?.strangledTurns ?? 0) > 0;
        const ability = strangled ? 'not able' : 'incapable';
        await pline(`You are ${ability} of calling upon ${deity} to turn aside evilness.`);
        state.context.move = priorCalls === 0 ? 1 : 0;
        return [];
    }
    const alignment = state.u?.ualign?.type ?? 0;
    if ((alignment >= 0 && heroIsDemonOrUndead(state))
        || (state.u?.ugangr ?? 0) > 6) {
        await pline(`For some reason, ${deity} seems to ignore you.`);
        aggravateMonsters(state, random);
        await exerciseAttribute(A_WIS, false, state);
        state.context.move = 1;
        return [];
    }
    if (inGehennom(state)) {
        await pline(`Since you are in Gehennom, ${deity} can't help you.`);
        aggravateMonsters(state, random);
        state.context.move = 1;
        return [];
    }
    await pline(`Calling upon ${deity}, you chant an arcane formula.`);
    await exerciseAttribute(A_WIS, true, state);
    const range = BOLT_LIM + Math.trunc((state.u?.ulevel ?? 1) / 5);
    const rangeSquared = range * range;
    const results = [];
    let falterMessageShown = false;
    const monsters = Array.from(state.level?.monsters || []).reverse();
    for (const monster of monsters) {
        const dx = (monster.mx ?? 0) - (state.u?.ux ?? 0);
        const dy = (monster.my ?? 0) - (state.u?.uy ?? 0);
        if (!couldsee(monster.mx, monster.my)
            || dx * dx + dy * dy > rangeSquared
            || !eligibleTarget(monster, state.u?.ulevel ?? 1))
            continue;
        const result = await turnOneMonster(monster, state, {
            finishMonsterKill,
            random,
        });
        if (result === 'hero-died')
            return results;
        results.push({ monster, result });
        if (result === 'faltered' && !falterMessageShown) {
            await pline('Unfortunately, your voice falters.');
            falterMessageShown = true;
        }
    }
    endVoluntaryMultiTurn(state);
    state._helplessTurns = Math.max(1, 5 - Math.trunc(((state.u?.ulevel ?? 1) - 1) / 6));
    state._helplessReason = 'trying to turn the monsters';
    state._helplessDoneMessage = 'You can move again.';
    state.context.move = 1;
    return results;
}
//# sourceMappingURL=turn_undead.js.map