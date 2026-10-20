// Monster-versus-monster digestion. C uhitm.c:mhitm_ad_dgst() and the
// post-death meal effects in mhitm.c:mdamagem().
import { G_NOCORPSE, M_ATTK_AGR_DIED, M_ATTK_MISS, ismnum } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { requireLiveGame } from './gstate.js';
import { mksobj, set_corpsenm } from './mklev.js';
import { healMonster } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import { grantMonsterCorpseIntrinsic } from './monster_corpse_intrinsic.js';
import { MONSTER_NAME, monsterIsRider } from './monster_data.js';
import { resolveMonsterCorpseChance } from './monster_death.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import type { Monster } from './monster_types.js';
import { monsterIsSlimeproof } from './monster_unslime.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { CORPSE } from './object_data.js';
import { deallocateObject } from './object_delete.js';
import { petFoodNutrition } from './pet_eating.js';
import { heroIsDeaf } from './senses.js';

const PM_FAMINE = MONSTER_NAME.indexOf('Famine');
const PM_PESTILENCE = MONSTER_NAME.indexOf('Pestilence');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');

export async function applyMonsterDigestionEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, publish, random, rollDice } = context;
    requireLiveGame(state);
    const species = defender.mnum;
    if (monsterIsRider(defender)) {
        if (context.visible && canSeeMonster(attacker)) {
            const fate = species === PM_FAMINE ? 'belches feebly, shrivels up and dies'
                : species === PM_PESTILENCE ? 'coughs spasmodically and collapses'
                    : 'vomits violently and drops dead';
            await publish(`${monsterName(attacker, { state, capitalized: true })} ${fate}!`);
        }
        const death = await context.finishDeath(attacker, { publish, random, rollDice });
        const died = attacker.mhp <= 0;
        const heroDied = !!death.heroDied || !!state.program_state.gameover;
        if (!heroDied && died && attacker.mtame && !context.visible)
            await publish('You have a queasy feeling for a moment, then it passes.');
        return { damage: context.damage, nativeResult: died ? M_ATTK_AGR_DIED : M_ATTK_MISS,
            done: true, heroDied };
    }

    if (state.flags.verbose && !heroIsDeaf(state)) await publish('"Burrrrp!"');
    await wakeMonstersNearWithMessages(attacker.mx, attacker.my, 4, state, publish);
    const damage = defender.mhp;
    const amulet = wornMonsterLifeSaver(defender);
    if (amulet)
        await destroyObjectFromMonsterInventory(defender, amulet, state, { silently: true, publish });

    // This check precedes the lethal damage. A gas spore explodes inside
    // the eater here, and a pet's meal never creates a map corpse.
    const previousSwallower = state._monsterSwallower;
    state._monsterSwallower = attacker;
    let corpse;
    try {
        corpse = await resolveMonsterCorpseChance(defender, { state, publish, random, rollDice });
    } finally {
        state._monsterSwallower = previousSwallower;
    }
    if (corpse.heroDied)
        return { damage, nativeResult: M_ATTK_MISS, done: true, heroDied: true };
    if (corpse.leavesRemains && attacker.mhp > 0 && attacker.mtame && !attacker.isminion
        && !((state.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE)) {
        const pet = attacker.edog;
        if (!pet) throw new Error(`Digesting pet ${attacker.m_id} has no feeding state`);
        const meal = await mksobj(CORPSE, false, false);
        set_corpsenm(meal, species);
        let nutrition = petFoodNutrition(attacker, meal);
        deallocateObject(meal, state);
        if ((attacker.meating ?? 0) > 1)
            attacker.meating = Math.trunc(((attacker.meating ?? 0) + 3) / 4);
        if (nutrition > 1) nutrition = Math.trunc(nutrition / 2);
        pet.hungrytime += nutrition;
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

interface MonsterDigestionFinishOptions {
    state: PlayingGameState;
    attackerSpecies: number;
    defenderSpecies: number;
    defenderShapechanger: number | undefined;
    publish?: MessagePublisher;
    growAttacker: MonsterCombatEffectContext['growAttacker'];
}

// Called only after monkilled() confirms that the meal died. Wraith growth
// replaces ordinary victim growth; every other meal permits it afterwards.
export async function finishMonsterDigestion(attacker: Monster, {
    state, attackerSpecies, defenderSpecies, defenderShapechanger,
    publish = plineWithContinuation, growAttacker,
}: MonsterDigestionFinishOptions): Promise<{ growNormally: boolean; heroDied: boolean }> {
    requireLiveGame(state);
    if (defenderShapechanger !== undefined && ismnum(defenderShapechanger)) {
        const change = await changeMonsterForm(attacker, null, state, { showMessage: true, publish });
        if (change?.heroDied) return { growNormally: false, heroDied: true };
    } else if (defenderSpecies === PM_GREEN_SLIME
        && !monsterIsSlimeproof({ mnum: attackerSpecies })) {
        const change = await changeMonsterForm(attacker, PM_GREEN_SLIME, state, { showMessage: true, publish });
        if (change?.heroDied) return { growNormally: false, heroDied: true };
    } else if (defenderSpecies === PM_WRAITH) {
        const growth = await growAttacker(null);
        return { growNormally: false, heroDied: growth.heroDied };
    } else if (defenderSpecies === PM_NURSE) {
        healMonster(attacker, attacker.mhpmax, 0);
    }
    await grantMonsterCorpseIntrinsic(attacker, defenderSpecies, state);
    return { growNormally: true, heroDied: !!state.program_state.gameover };
}
