// Hero stick and wrap attacks. C uhitm.c:mhitm_ad_stck(), mhitm_ad_wrap().
import { setHeroGrip } from './hero_grip.js';
import { armorSimpleName } from './armor.js';
import { monsterLegName } from './body_parts.js';
import { MGIVENNAME, M_ATTK_MISS, W_ARM, W_ARMC, W_ARMH, W_ARMU } from './const.js';
import { heroSpecies } from './hero_species.js';
import { specialAttackNegated } from './magic_negation.js';
import { AD_STCK, AD_WRAP, AT_HUGS } from './monster_attack_types.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterIsSlithy,
    monsterSpeciesSticks,
} from './monster_data.js';
import { monsterName, possessiveName } from './monster_name.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectName } from './objnam.js';
import { objectTypeKnown } from './shk.js';
import { isPoolAt } from './terrain_properties.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { HeroNaturalEffectContext, HeroNaturalEffectResult } from './hero_natural_types.js';
import type { Monster } from './monster_types.js';
import type { rn2 } from './rng.js';

const PM_BARBED_DEVIL = MONSTER_NAME.indexOf('barbed devil');
const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
const S_NAGA = 40;
const S_SNAKE = 45;
const M1_SWIM = 0x00000002;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;

export async function applyHeroNaturalGrip(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    let damage = context.damage;
    if (context.attack[1] === AD_STCK) {
        await stickToMonster(monster, context);
    } else if (context.attack[1] === AD_WRAP) {
        damage = await wrapMonster(monster, context);
    } else {
        throw new RangeError(`Unsupported hero grip damage type ${context.attack[1]}`);
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

async function stickToMonster(monster: Monster, {
    state, publish, random,
}: HeroNaturalEffectContext): Promise<void> {
    const negated = specialAttackNegated(state.u, monster, { state, random });
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (negated || monsterSpeciesSticks(monster.mnum) || distance > 2) return;
    setHeroGrip(monster, state);
    if (heroSpecies(state) === PM_BARBED_DEVIL) {
        const target = monsterName(monster, {
            state, article: monster.mtame ? 'your' : 'the',
            suppressSaddle: !!MGIVENNAME(monster) || state.u.usteed === monster,
        });
        await publish(`Your barbs stick to ${target}!`);
    }
}

async function wrapMonster(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, publish, random, damage, attack, target } = context;
    if (monsterSpeciesSticks(monster.mnum)) return 0;
    const species = heroSpecies(state);
    const symbol = MONSTER_SYMBOL[species];
    const coils = monsterIsSlithy(species) && (symbol === S_SNAKE || symbol === S_NAGA);
    // The pinned source uses !notonhead here, even though hmonas rejects
    // worm-tail hugs before this effect. Retain that branch polarity.
    const tailMiss = target.x === monster.mx && target.y === monster.my;
    if (!state.u.ustuck && !tailMiss && random(10) === 0) {
        if (await monsterSlipsFromHeroGrip(monster, { head: false, state, publish, random }))
            return 0;
        await publish(`You ${coils ? 'coil' : 'swing'} yourself around ${monsterName(monster, { state })}!`);
        setHeroGrip(monster, state);
        return damage;
    }
    if (state.u.ustuck === monster && !tailMiss) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (isPoolAt(state.u.ux, state.u.uy, state) && !(flags & (M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS))) {
            await publish(`You drown ${monsterName(monster, { state })}...`);
            // damageum owns subtraction, life saving, and hero kill credit.
            return monster.mhp;
        }
        if (attack[0] === AT_HUGS)
            await publish(`${monsterName(monster, { state, capitalized: true })} is being crushed.`);
        return damage;
    }
    if (state.flags.verbose) {
        const name = monsterName(monster, { state });
        const targetName = coils && !tailMiss ? name
            : `${possessiveName(name)} ${tailMiss ? 'tail' : monsterLegName(monster.mnum)}`;
        await publish(`You brush against ${targetName}.`);
    }
    return 0;
}

interface HeroGripSlipContext {
    head: boolean;
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
}

// C m_slips_free(): head attacks inspect only the helmet; body grabs inspect
// the outermost clothing. A covered greased item offers no protection.
export async function monsterSlipsFromHeroGrip(
    monster: Monster, { head, state, publish, random }: HeroGripSlipContext,
): Promise<boolean> {
    const layers = head ? [W_ARMH] : [W_ARMC, W_ARM, W_ARMU];
    const armor = layers.map(mask => monster.minvent?.find(object => (object.owornmask ?? 0) & mask))
        .find(object => object !== undefined);
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;
    const target = possessiveName(monsterName(monster, { state }));
    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectName(armor, state) : armorSimpleName(armor, state);
    await publish(`You ${head ? 'grab, but cannot hold onto' : 'slip off of'} ${target} ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}
