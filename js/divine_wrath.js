// Divine retaliation.
// C pray.c:gods_upset(), angrygods(), god_zaps_you(), fry_by_god().

import { adjustHeroAlignment, deityName } from './alignment.js';
import { disintegrateWornArmor } from './armor.js';
import { adjustAttribute, attributeChangeMessage } from './attrib.js';
import {
    A_NONE, A_WIS, ALTAR, Amask2align, Is_astralevel,
    M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_REFL,
} from './const.js';
import {
    displayColorName, plineWithContinuation as pline, shieldeff,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { adjustLevelAbilities, loseExperienceLevel } from './exper.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { summonMinion } from './minion.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import {
    monsterHasDisintegrationResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { propertyIsActive, wornObjectGrantsProperty } from './properties.js';
import { heroIsPunished } from './ball.js';
import { punishHero } from './punishment.js';
import {
    discoverHeroReflectionSource, heroReflectionSource, heroReflectsRay,
} from './ray.js';
import { rn2, rnz } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { attrcurse, rndcurse } from './throne.js';

const GOD_VOICES = ['booms out', 'thunders', 'rings out', 'booms'];
const S_HUMAN = 53;

export async function godVoice(alignment, words = null, state = game) {
    const voice = GOD_VOICES[rn2(GOD_VOICES.length)];
    const speech = words === null ? '' : `"${words}"`;
    await pline(`The voice of ${deityName(alignment, state)} ${voice}: ${speech}`);
}

export function angryGodMaximum({
    responseAlignment, heroAlignment, alignmentRecord = 0, anger = 0, luck = 0,
}) {
    let maximum;
    if (responseAlignment !== heroAlignment) {
        maximum = Math.trunc(alignmentRecord / 2)
            + (luck > 0 ? Math.trunc(-luck / 3) : -luck);
    } else {
        maximum = 3 * anger
            + (luck > 0 || alignmentRecord >= 4 ? Math.trunc(-luck / 3) : -luck);
    }
    return Math.max(1, Math.min(15, maximum));
}

export async function godsUpset(alignment, state = game) {
    if (alignment === state.u.ualign.type)
        state.u.ugangr = (state.u.ugangr || 0) + 1;
    else if (state.u.ugangr > 0) state.u.ugangr--;
    await angryGods(alignment, state);
}

export async function desecrateAltar(highAltar, alignment, state = game) {
    if (alignment === state.u.ualign.type) {
        adjustHeroAlignment(-20, state);
        state.u.ugangr = (state.u.ugangr || 0) + 5;
    }
    await pline('You feel the air around you grow charged...');
    await pline(`Suddenly, you realize that ${deityName(alignment, state)} has noticed you...`);
    await godVoice(alignment, `So, mortal!  You dare desecrate my ${highAltar ? 'High Temple' : 'altar'}!`, state);
    await godZapsHero(alignment, state);
}

export async function angryGods(alignment, state = game) {
    const hero = state.u;
    if (state.dungeons?.[hero.uz.dnum]?.flags?.hellish) alignment = A_NONE;
    hero.ublessed = 0;
    const maximum = angryGodMaximum({
        responseAlignment: alignment,
        heroAlignment: hero.ualign.type,
        alignmentRecord: hero.ualign.record,
        anger: hero.ugangr,
        luck: (hero.uluck || 0) + (hero.moreluck || 0),
    });
    const outcome = rn2(maximum);
    const mortal = MONSTER_SYMBOL[hero.umonnum] === S_HUMAN ? 'mortal' : 'creature';
    switch (outcome) {
    case 0:
    case 1: {
        const mood = heroIsHallucinating(state) ? 'bummed' : 'displeased';
        await pline(`You feel that ${deityName(alignment, state)} is ${mood}.`);
        break;
    }
    case 2:
    case 3: {
        await godVoice(alignment, null, state);
        const accusation = hero.ualign.record < 0 && alignment === hero.ualign.type
            ? 'hast strayed from the path' : 'art arrogant';
        await pline(`"Thou ${accusation}, ${mortal}."`);
        await pline('"Thou must relearn thy lessons!"');
        const change = adjustAttribute(A_WIS, -1, state);
        const message = attributeChangeMessage(A_WIS, change);
        if (message) await pline(message);
        const loss = loseExperienceLevel(state);
        if (loss.oldLevel > 1) {
            await pline(`Goodbye level ${loss.oldLevel}.`);
            await adjustLevelAbilities(loss.oldLevel, loss.newLevel);
        }
        break;
    }
    case 6:
        if (!heroIsPunished(state)) {
            await godVoice(alignment, 'Thou hast angered me.', state);
            await punishHero(null, state);
            break;
        }
        // An already-punished hero receives a curse instead.
    case 4:
    case 5:
        await godVoice(alignment, 'Thou hast angered me.', state);
        if (!heroIsBlind(state) && !hero.antimagic) {
            const color = displayColorName('black', state);
            await pline(`${/^[aeiou]/i.test(color) ? 'An' : 'A'} ${color} glow surrounds you.`);
        }
        if (rn2(2) || !await attrcurse()) await rndcurse();
        break;
    case 7:
    case 8: {
        await godVoice(alignment, null, state);
        const location = state.level.at(hero.ux, hero.uy);
        const scorn = location.typ === ALTAR && Amask2align(location.flags) !== alignment;
        await pline(`"Thou durst ${scorn ? 'scorn' : 'call upon'} me?"`);
        await pline(`"Then die, ${mortal}!"`);
        await summonMinion(alignment);
        break;
    }
    default:
        await godVoice(alignment, 'Thou hast angered me.', state);
        await godZapsHero(alignment, state);
    }
    if (!state.program_state.gameover)
        hero.ublesscnt = Math.max(hero.ublesscnt || 0, rnz(300));
}

export async function fryByGod(alignment, disintegration = false, state = game) {
    await pline(disintegration
        ? 'You disintegrate into a pile of dust!' : 'You fry to a crisp!');
    return finishHeroDeath({
        killer: `the wrath of ${deityName(alignment, state)}`,
        deathLineShown: true,
    });
}

export async function godZapsHero(alignment, state = game) {
    const hero = state.u;
    if (hero.uswallow) {
        await pline('Suddenly a bolt of lightning comes down at you from the heavens!');
        await strikeSwallower(false, state);
    } else {
        await pline('Suddenly, a bolt of lightning strikes you!');
        if (heroReflectsRay(state)) {
            await shieldeff(hero.ux, hero.uy, state);
            if (heroIsBlind(state)) await pline("For some reason you're unaffected.");
            else {
                const reflection = heroReflectionSource(state);
                if (reflection) {
                    await pline(`It reflects from your ${reflection.noun}.`);
                    discoverHeroReflectionSource(reflection, state);
                }
            }
            monstersObserveHeroResistance(M_SEEN_REFL, state);
        } else if (hero.shockResistance || propertyIsActive('shockResistance', state)) {
            await shieldeff(hero.ux, hero.uy, state);
            await pline('It seems not to affect you.');
            monstersObserveHeroResistance(M_SEEN_ELEC, state);
            monstersForgetHeroResistance(M_SEEN_REFL, state);
        } else {
            if (await fryByGod(alignment, false, state)) return;
            monstersForgetHeroResistance(M_SEEN_REFL | M_SEEN_ELEC, state);
        }
    }
    if (state.program_state.gameover) return;
    await pline(`${deityName(alignment, state)} is not deterred...`);
    if (hero.uswallow) {
        await strikeSwallower(true, state);
        return;
    }
    await pline('A wide-angle disintegration beam hits you!');
    for (const slot of ['uarms', 'uarmc', 'uarm', 'uarmu']) {
        const armor = state[slot] || hero[slot];
        if (!armor) continue;
        const cloak = state.uarmc || hero.uarmc;
        const suit = state.uarm || hero.uarm;
        if (slot === 'uarm' && cloak || slot === 'uarmu' && (suit || cloak)) continue;
        const protectedArmor = wornObjectGrantsProperty(armor, 'reflection', state)
            || wornObjectGrantsProperty(armor, 'disintegrationResistance', state);
        if (slot !== 'uarmu' && protectedArmor) continue;
        await disintegrateWornArmor(armor, { state });
        if (state.program_state.gameover) return;
    }
    if (hero.disintegrationResistance || propertyIsActive('disintegrationResistance', state)) {
        await pline('You bask in its black glow for a minute...');
        await godVoice(alignment, 'I believe it not!', state);
        monstersObserveHeroResistance(M_SEEN_DISINT, state);
    } else {
        if (await fryByGod(alignment, true, state)) return;
        monstersForgetHeroResistance(M_SEEN_DISINT, state);
    }
    const sanctum = state.sanctum_level;
    const highTemple = Is_astralevel(hero.uz)
        || sanctum && sanctum.dnum === hero.uz.dnum && sanctum.dlevel === hero.uz.dlevel;
    if (highTemple) {
        await pline('"Thou cannot escape my wrath, mortal!"');
        for (let count = 0; count < 3; count++) await summonMinion(alignment);
        await pline(`"Destroy ${state.flags.female ? 'her' : 'him'}, my servants!"`);
    }
}

async function strikeSwallower(disintegration, state) {
    const monster = state.u.ustuck;
    const name = MONSTER_NAME[monster.mnum];
    await pline(disintegration
        ? `A wide-angle disintegration beam aimed at you hits the ${name}!`
        : `It strikes the ${name}!`);
    const resisted = disintegration
        ? monsterHasDisintegrationResistance(monster) : monsterHasShockResistance(monster);
    if (resisted) {
        await pline(`The ${name} seems unaffected.`);
        return;
    }
    const fate = disintegration ? 'disintegrates into a pile of dust' : 'fries to a crisp';
    await pline(`The ${name} ${fate}!`);
    await finishHeroMonsterKill(monster, monster.mx, monster.my, {
        showKillMessage: false, recordConduct: false, noCorpse: disintegration,
    });
}
