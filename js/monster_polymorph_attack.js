// Involuntary monster polymorph caused by a potion.
// C refs: zap.c bhitm(POT_POLYMORPH) and mon.c newcham().

import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { rn2 } from './rng.js';

const POTION_ATTACK_LEVEL = 6;
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

function survived(monster) {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}

function alreadyChangedThisAttack(monster) {
    return (Number.isInteger(monster?.mcorpsenm) && monster.mcorpsenm >= 0)
        || (Number.isInteger(monster?.mextra?.mcorpsenm)
            && monster.mextra.mcorpsenm >= 0);
}

function markNewLongWorm(monster, state) {
    if (monster.mnum !== PM_LONG_WORM) return;
    if (!monster.mextra) monster.mextra = {};
    monster.mextra.mcorpsenm = PM_LONG_WORM;
    if (!state.context) state.context = {};
    state.context.bypasses = true;
}

function heroHallucinates(state) {
    return !!(state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0);
}

function monsterSubject(monster) {
    if (monster.name) return monster.name;
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export async function polymorphMonsterFromPotion(monster, {
    state = game,
    targetSpotted = false,
    wakeMonster,
    publish,
    showShield,
    finishDeath,
} = {}) {
    if (monster.mnum === PM_LONG_WORM
        && alreadyChangedThisAttack(monster)) {
        await wakeMonster?.(monster);
        return { changed: false, alreadyChanged: true, killed: false };
    }

    const magicResistant = monsterHasMagicResistance(monster);
    if (magicResistant) await showShield?.(monster);
    const resisted = !magicResistant
        && monsterResistsEffect(monster, POTION_ATTACK_LEVEL);
    let systemShock = false;
    let change = null;
    let selfTouch = null;

    if (!magicResistant && !resisted) {
        const naturalShapechanger = Number.isInteger(monster.cham)
            && monster.cham >= 0;
        systemShock = !naturalShapechanger && rn2(25) === 0;
        if (systemShock) {
            if (targetSpotted)
                await publish(`${monsterSubject(monster)} shudders!`);
            if (!finishDeath)
                throw new Error('polymorph fatality owner unavailable');
            await finishDeath(monster, { noCorpse: true });
        } else {
            const heroInsideTarget = state.u?.uswallow
                && state.u?.ustuck === monster;
            change = await changeMonsterForm(monster, null, state, {
                showMessage: !heroHallucinates(state) && (targetSpotted || heroInsideTarget),
                creditHero: true,
                finishDeath: (target, death) => {
                    if (!finishDeath)
                        throw new Error('polymorph self-touch requires a monster death handler');
                    return finishDeath(target, {
                        ...death,
                        showKillMessage: false,
                        recordConduct: false,
                    });
                },
                publish,
                polyspot: true,
            });
            selfTouch = change?.selfTouch || null;
        }
        if (survived(monster)) markNewLongWorm(monster, state);
    }

    const killed = !survived(monster);
    if (!killed) await wakeMonster?.(monster);
    return {
        changed: !!change,
        change,
        selfTouch,
        magicResistant,
        resisted,
        systemShock,
        killed,
    };
}
