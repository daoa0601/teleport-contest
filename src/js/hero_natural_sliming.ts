// C uhitm.c:mhitm_ad_slim(), hero attacking a monster.
import { M_ATTK_DEF_DIED, M_ATTK_MISS } from './const.js';
import { specialAttackNegated } from './magic_negation.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterIsSlimeproof, tryMonsterUnslime } from './monster_unslime.js';
import type { HeroNaturalEffectContext, HeroNaturalEffectResult } from './hero_natural_types.js';
import type { Monster } from './monster_types.js';

const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');

export async function applyHeroNaturalSliming(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    const { state, publish, random, rollDice, rollOne } = context;
    const normal: HeroNaturalEffectResult = {
        damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
    };
    if (specialAttackNegated(state.u, monster, { state, random })
        || random(4) !== 0 || monsterIsSlimeproof(monster)) return normal;

    const cure = await tryMonsterUnslime(monster, {
        state, byHero: true, publish, random, rollDice, rollOne,
    });
    if (cure.heroDied) return { ...normal, damage: 0, done: true, heroDied: true };
    if (!cure.cured && monster.mhp > 0) {
        await publish(`You turn ${monsterName(monster, { state })} into slime.`);
        const change = await changeMonsterForm(monster, PM_GREEN_SLIME, state, {
            showMessage: false, publish,
        });
        if (change?.heroDied) return { ...normal, damage: 0, done: true, heroDied: true };
    }
    if (monster.mhp <= 0)
        return { damage: context.damage, nativeResult: M_ATTK_DEF_DIED, done: true, heroDied: false };
    return { ...normal, damage: 0 };
}
