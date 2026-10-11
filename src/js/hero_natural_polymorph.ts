// C uhitm.c:mhitm_ad_poly() and mhitm.c:mon_poly(), for a hero attacker.
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { askTeleportDestination } from './cmd.js';
import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, NON_PM } from './const.js';
import { canSeeMonster, canSpotMonster, shieldeff } from './display.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroSpecies } from './hero_species.js';
import { specialAttackNegated } from './magic_negation.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2 } from './monster_data.js';
import { monsterName, namelessMonsterName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { teleportHero } from './teleport.js';
import { cansee } from './vision.js';
import type { HeroNaturalEffectContext, HeroNaturalEffectResult } from './hero_natural_types.js';
import type { Monster } from './monster_types.js';

const M1_TPORT = 0x02000000;
const M2_SHAPESHIFTER = 0x00004000;

export async function applyHeroNaturalPolymorph(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    const { state, publish, random } = context;
    const negated = specialAttackNegated(state.u, monster, { state, random });
    if (state.uwep || state.u.uwep || context.damage >= monster.mhp)
        return { damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
    if (negated) {
        await publish(`${monsterName(monster, { state, capitalized: true })} is not transformed.`);
        return { damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
    }

    const visible = canSeeMonster(monster)
        || Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) <= 1;
    const before = monsterName(monster, { state, capitalized: true });
    let damage = context.damage;
    let heroDied = false;
    if (monsterHasMagicResistance(monster)) {
        if (visible) await showPolymorphResistance(monster, context);
    } else if (monsterResistsEffect(monster, 12, random)) {
        await showPolymorphResistance(monster, context);
    } else if (random(25) === 0 && (monster.cham ?? NON_PM) === NON_PM
        && (monster.mcan || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_SHAPESHIFTER) !== 0)) {
        if (visible) await publish(`${before} shudders!`);
        monster.mhp -= damage + Math.trunc((monster.mhpmax + 1) / 2);
        damage = 0;
        if (monster.mhp <= 0) {
            const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
                noCorpse: true, publish,
            });
            heroDied = death.heroDied;
        }
    } else {
        const change = await changeMonsterForm(monster, null, state, {
            publish, creditHero: true,
            finishDeath: (victim, options) => finishHeroMonsterKillOutcome(
                victim, victim.mx, victim.my, {
                    ...options, showKillMessage: false, recordConduct: false, publish,
                },
            ),
        });
        if (change) {
            damage = 0;
            heroDied = change.heroDied;
            if (!heroDied && visible) {
                const wasSeen = before.toLowerCase() !== 'it';
                if (canSpotMonster(monster)) {
                    const description = namelessMonsterName(monster, {
                        state, article: 'a', suppressIt: true, suppressInvisible: true,
                    });
                    const transformation = state.flags.verbose || !wasSeen
                        ? ' undergoes a freakish metamorphosis and' : '';
                    await publish(`${before}${transformation} turns into ${description}.`);
                } else {
                    await publish(`${before} undergoes a freakish metamorphosis${wasSeen ? ' and disappears' : ''}.`);
                }
            }
            if (!heroDied && ((MONSTER_FLAGS1[heroSpecies(state)] ?? 0) & M1_TPORT) !== 0) {
                const teleport = await teleportHero({ chooseDestination: askTeleportDestination });
                heroDied = teleport.died;
            }
        } else if (visible && state.flags.verbose) {
            await publish('Nothing happens.');
        }
    }

    // Once mon_poly ran, damageum skips its common HP subtraction even if
    // resistance or a failed shape change left the original damage intact.
    return {
        damage, nativeResult: M_ATTK_HIT | (monster.mhp <= 0 ? M_ATTK_DEF_DIED : 0),
        done: true, heroDied,
    };
}

async function showPolymorphResistance(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    await shieldeff(monster.mx, monster.my, context.state);
    if (cansee(monster.mx, monster.my))
        await context.publish(`${monsterName(monster, { state: context.state, capitalized: true })} resists!`);
}
