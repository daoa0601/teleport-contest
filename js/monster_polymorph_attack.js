// Involuntary monster polymorph caused by magic.
// C refs: zap.c bhitm() and mon.c newcham().
import { heroIsHallucinating } from './senses.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { rn2 } from './rng.js';
import { plineWithContinuation } from './display.js';
const POTION_ATTACK_LEVEL = 6;
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
function survived(monster) {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}
function alreadyChangedThisAttack(monster) {
    const corpseSpecies = monster.mcorpsenm;
    const extraCorpseSpecies = monster.mextra?.mcorpsenm;
    return (corpseSpecies !== undefined && Number.isInteger(corpseSpecies) && corpseSpecies >= 0)
        || (extraCorpseSpecies !== undefined && Number.isInteger(extraCorpseSpecies)
            && extraCorpseSpecies >= 0);
}
function markNewLongWorm(monster, state) {
    if (monster.mnum !== PM_LONG_WORM)
        return;
    if (!monster.mextra)
        monster.mextra = {};
    monster.mextra.mcorpsenm = PM_LONG_WORM;
    state.context.bypasses = true;
}
function monsterSubject(monster) {
    if (monster.name)
        return monster.name;
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}
export async function polymorphMonsterFromMagic(monster, { state = game, targetSpotted = false, wakeMonster, publish = plineWithContinuation, showShield, finishDeath, attackLevel = POTION_ATTACK_LEVEL, polyspot = false, } = {}) {
    if (monster.mnum === PM_LONG_WORM
        && alreadyChangedThisAttack(monster)) {
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return { changed: false, alreadyChanged: true, killed: false };
    }
    const magicResistant = monsterHasMagicResistance(monster);
    if (magicResistant)
        await showShield?.(monster);
    const resisted = !magicResistant
        && monsterResistsEffect(monster, attackLevel);
    let systemShock = false;
    let change = null;
    let selfTouch = null;
    if (!magicResistant && !resisted) {
        if (polyspot) {
            for (const object of monster.minvent || monster.inventory || []) {
                object.bypass = true;
                state.context.bypasses = true;
            }
        }
        const naturalSpecies = monster.cham;
        const naturalShapechanger = naturalSpecies !== undefined
            && Number.isInteger(naturalSpecies) && naturalSpecies >= 0;
        systemShock = !naturalShapechanger && rn2(25) === 0;
        if (systemShock) {
            if (targetSpotted)
                await publish(`${monsterSubject(monster)} shudders!`);
            if (!finishDeath)
                throw new Error('polymorph fatality owner unavailable');
            const death = await finishDeath(monster, { noCorpse: true });
            if (death.heroDied)
                return { heroDied: true };
        }
        else {
            const heroInsideTarget = !!state.u.uswallow
                && state.u.ustuck === monster;
            const changeOptions = {
                showMessage: !heroIsHallucinating(state) && (targetSpotted || heroInsideTarget),
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
                polyspot,
            };
            change = await changeMonsterForm(monster, null, state, changeOptions);
            if (!change && naturalShapechanger)
                change = await changeMonsterForm(monster, naturalSpecies, state, changeOptions);
            if (change?.heroDied)
                return {
                    changed: true, change, heroDied: true,
                    magicResistant, resisted, systemShock, killed: false,
                };
            selfTouch = change?.selfTouch || null;
        }
        if (survived(monster))
            markNewLongWorm(monster, state);
    }
    const killed = !survived(monster);
    if (!killed && (await wakeMonster?.(monster))?.heroDied)
        return { heroDied: true };
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
//# sourceMappingURL=monster_polymorph_attack.js.map