// C uhitm.c:mhitm_ad_wrap() against the hero, and mhitu.c:u_slip_free().
import { armorSimpleName } from './armor.js';
import { heroLegName } from './body_parts.js';
import { DROWNING, POOL, WATER } from './const.js';
import type { MessagePublisher } from './display.js';
import { finishHeroDeath } from './end.js';
import type { PlayingGameState } from './game_state.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { AT_ENGL, AT_HUGS } from './monster_attack_types.js';
import type { HeroContactAttack } from './monster_action_types.js';
import { MONSTER_FLAGS1, MONSTER_SYMBOL, monsterIsSlithy, monsterTypeName } from './monster_data.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectCombatName } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { objectTypeKnown } from './shk.js';
import type { rn2 } from './rng.js';
import { isPoolAt, levelIsWaterLevel } from './terrain_properties.js';

const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
const S_NAGA = 40;
const S_SNAKE = 45;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;

export async function resolveMonsterWrapping(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    const hero = state.u;
    if ((monster.mcan && hero.ustuck !== monster) || heroFormSticks(state)) {
        attack.damage = 0;
        return;
    }
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const coils = monsterIsSlithy(monster.mnum) && (symbol === S_SNAKE || symbol === S_NAGA);
    if (!hero.ustuck && random(10) === 0) {
        if (await heroSlipsFromWrapping(monster, attack, state, publish, random)) {
            attack.damage = 0;
            return;
        }
        hero.ustuck = monster;
        state.context.botl = true;
        await publish(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} ${coils ? 'coils' : 'swings'} itself around you!`, { urgent: true });
        return;
    }
    if (hero.ustuck !== monster) {
        attack.damage = 0;
        if (state.flags.verbose) {
            await publish(`${monsterName(monster, { state, capitalized: true })} brushes against ${coils ? 'you' : `your ${heroLegName(state)}`}.`);
        }
        return;
    }
    if (isPoolAt(monster.mx, monster.my, state) && !heroSurvivesWrappingUnderwater(state)) {
        await publish(`${monsterName(monster, { state, capitalized: true })} drowns you...`, { urgent: true });
        const terrain = state.level.requireAt(monster.mx, monster.my).typ;
        const medusa = state.medusa_level;
        const onMedusa = medusa && medusa.dnum === hero.uz.dnum && medusa.dlevel === hero.uz.dlevel;
        const moat = terrain !== POOL && terrain !== WATER && !onMedusa && !levelIsWaterLevel(state);
        const species = withIndefiniteArticle(monsterTypeName(monster.mnum, !!monster.female));
        const killer = `${moat ? 'moat' : 'pool of water'} by ${species}`;
        attack.heroDied = await finishHeroDeath({
            killer, deathType: DROWNING, deathVerb: 'drowned', deathLineShown: true,
            deathCause: `drowned in ${withIndefiniteArticle(killer)}`,
        });
        return;
    }
    if (attack.attackType === AT_HUGS) await publish('You are being crushed.');
}

function heroSurvivesWrappingUnderwater(state: PlayingGameState): boolean {
    const flags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    return !!(state.u.swimming || state.u.amphibious || state.u.breathless || state.u.magicalBreathing
        || (flags & (M1_AMPHIBIOUS | M1_BREATHLESS))
        || propertyIsActive('swimming', state) || propertyIsActive('magicalBreathing', state));
}

async function heroSlipsFromWrapping(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<boolean> {
    if (attack.attackType === AT_ENGL) return false;
    const armor = state.uarmc || state.uarm || state.uarmu;
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;
    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectCombatName(armor, { state }) : armorSimpleName(armor, state);
    await publish(`${monsterName(monster, { state, capitalized: true })} slips off of your ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}
