// C attrib.c:from_what(), is_innate(), innately(); artifact.c:what_gives().
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { ArtifactDefense, ArtifactFlag } from './data_types.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import {
    FROMEXPER, FROMFORM, FROMOUTSIDE, FROMRACE, I_SPECIAL, INTRINSIC,
    W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU,
    W_ART, W_ARTI, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP,
} from './const.js';
import { artifactById } from './artifacts.js';
import { heroFaceName } from './body_parts.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { CORNUTHAUM, MUMMY_WRAPPING } from './object_data.js';
import { ownedSimpleObjectName } from './objnam.js';
import { propertyTimeout } from './properties.js';
import { blindnessBlocked, blindfolded, isEyesOfTheOverworld } from './senses.js';
import { ROLE_LEVEL_ABILITIES, RACE_LEVEL_ABILITIES } from './innate_abilities.js';

export type InnateSource = 'none' | 'role' | 'race' | 'outside' | 'experience' | 'form' | 'lycanthropy';
const SLOT_MASKS: Readonly<Record<WornPropertySlot, number>> = {
    uarm: W_ARM, uarmc: W_ARMC, uarmh: W_ARMH, uarms: W_ARMS,
    uarmg: W_ARMG, uarmf: W_ARMF, uarmu: W_ARMU,
    uleft: W_RINGL, uright: W_RINGR, uamul: W_AMUL, ublindf: W_TOOL,
    uwep: W_WEP, uswapwep: W_SWAPWEP, uquiver: W_QUIVER,
};

export function intrinsicPropertyMask(property: PropertyName, state: GameState = game): number {
    const sources = state.u._propertySources?.[property]?.intrinsic;
    return propertyTimeout(property, state)
        | (sources?.role || sources?.experience ? FROMEXPER : 0)
        | (sources?.race ? FROMRACE : 0)
        | (sources?.outside || property === 'blinded' && state.u.permaBlind ? FROMOUTSIDE : 0)
        | (sources?.form ? FROMFORM : 0)
        | (sources?.potion ? I_SPECIAL : 0);
}

export function extrinsicPropertyMask(property: PropertyName, state: GameState = game): number {
    const sources = state.u._propertySources?.[property];
    let mask = (sources?.carried.length ? W_ART : 0) | (sources?.invoked ? W_ARTI : 0);
    for (const source of sources?.worn ?? []) mask |= SLOT_MASKS[source.slot];
    // Eyewear stores BLINDED directly rather than through the property list.
    if (property === 'blinded' && blindfolded(state)) mask |= W_TOOL;
    return mask;
}

export function veryFast(state: GameState = game): boolean {
    return !!((intrinsicPropertyMask('fast', state) & ~INTRINSIC)
        || extrinsicPropertyMask('fast', state));
}

// Native checks the role/race tables at the current level even if an outside
// effect removed the corresponding source bit. The tables are shared with adjabil.
function innately(property: PropertyName, state: GameState): InnateSource {
    const roleAbility = state.urole && ROLE_LEVEL_ABILITIES[state.urole.key]
        .find(([level, ability]) => ability === property && (state.u.ulevel ?? 0) >= level);
    if (roleAbility) return roleAbility[0] === 1 ? 'role' : 'experience';
    const raceAbility = state.urace && RACE_LEVEL_ABILITIES[state.urace.name]
        ?.find(([level, ability]) => ability === property && (state.u.ulevel ?? 0) >= level);
    if (raceAbility) return 'race';
    const intrinsic = intrinsicPropertyMask(property, state);
    if (intrinsic & FROMOUTSIDE) return 'outside';
    if (intrinsic & FROMFORM) return 'form';
    return 'none';
}

export function isInnate(property: PropertyName, state: GameState = game): InnateSource {
    if (property === 'drainResistance' && (state.u.ulycn ?? -1) >= 0) return 'lycanthropy';
    if (property === 'fast' && veryFast(state)) return 'none';
    const source = innately(property, state);
    if (source !== 'none') return source;
    if (property === 'jumping' && state.urole?.key === 'knight'
        && !extrinsicPropertyMask(property, state)) return 'role';
    if (property === 'blinded' && heroHasNoEyes(state)
        || property === 'blindResistance' && (intrinsicPropertyMask(property, state) & FROMFORM))
        return 'form';
    return 'none';
}

export function fromWhat(property: PropertyName, state: GameState = game, blocked = false): string {
    if (!state.flags.debug) return '';
    if (blocked) return blockedProvenance(property, state);
    const source = isInnate(property, state);
    let suffix = '';
    if (property === 'blinded' && state.u.uroleplay?.blind
        || property === 'deaf' && state.u.uroleplay?.deaf) suffix = ' from birth';
    else if (source === 'role' || source === 'race') suffix = ' innately';
    else if (source === 'outside') suffix = ' intrinsically';
    else if (source === 'experience') suffix = ' because of your experience';
    else if (source === 'lycanthropy') suffix = ' due to your lycanthropy';
    else if (source === 'form') suffix = ' from your creature form';
    else if (property === 'fast' && veryFast(state)) {
        const boots = state.uarmf || state.u.uarmf;
        const extrinsic = extrinsicPropertyMask(property, state);
        const cause = propertyTimeout(property, state) ? 'a potion or spell'
            : (extrinsic & W_ARMF) && boots?.dknown && state._knownObjectTypes?.has(boots.otyp)
                ? ownedSimpleObjectName(boots, state, { capitalized: false })
                : extrinsic ? 'worn equipment' : 'something';
        suffix = ` because of ${cause}`;
    } else {
        const object = whatGives(property, state);
        if (object) suffix = ` because of ${propertyObjectName(object, state)}`;
        else if (property === 'blinded' && blindfolded(state)
            && !intrinsicPropertyMask(property, state) && !heroHasNoEyes(state)) {
            const blindfold = state.ublindf || state.u.ublindf;
            if (blindfold) suffix = ` because of ${ownedSimpleObjectName(blindfold, state, { capitalized: false })}`;
        } else if (property === 'blinded' && state.u.ucreamed
            && propertyTimeout(property, state) === state.u.ucreamed
            && !extrinsicPropertyMask(property, state)
            && intrinsicPropertyMask(property, state) === state.u.ucreamed) {
            // The native text deliberately has no leading space here.
            suffix = `due to goop covering your ${heroFaceName(state)}`;
        }
    }
    suffix = suffix.replace(/ pair of /i, ' ');
    if (property === 'strangled') suffix = suffix.replace(/ of strangulation.*$/i, '');
    return suffix;
}

function propertyObjectName(object: GameObject, state: GameState): string {
    return artifactById(object.oartifact, state)?.name.replace(/^The /, 'the ')
        ?? ownedSimpleObjectName(object, state, { capitalized: false });
}

function blockedProvenance(property: PropertyName, state: GameState): string {
    const blindfold = state.ublindf || state.u.ublindf;
    if (property === 'blinded' && blindnessBlocked(state) && isEyesOfTheOverworld(blindfold, state)
        && blindfold) return ` because of ${propertyObjectName(blindfold, state)}`;
    const cloak = state.uarmc || state.u.uarmc;
    if (property === 'invisible' && cloak?.otyp === MUMMY_WRAPPING)
        return ` because of ${ownedSimpleObjectName(cloak, state, { capitalized: false })}`;
    const helmet = state.uarmh || state.u.uarmh;
    if (property === 'clairvoyant' && state.u.clairvoyanceBlocked && helmet?.otyp === CORNUTHAUM)
        return ` because of ${ownedSimpleObjectName(helmet, state, { capitalized: false })}`;
    return '';
}

export function heroHasNoEyes(state: GameState = game): boolean {
    return !!((MONSTER_FLAGS1[state.u.umonnum ?? -1] ?? 0) & 0x00001000);
}

const DEFENSES: Readonly<Partial<Record<PropertyName, ArtifactDefense>>> = {
    fireResistance: 'fire', coldResistance: 'cold', antimagic: 'magic',
    poisonResistance: 'poison', drainResistance: 'life-drain',
};
const FLAGS: Readonly<Partial<Record<PropertyName, ArtifactFlag>>> = {
    searching: 'SPFX_SEARCH', hallucinationResistance: 'SPFX_HALRES', telepathy: 'SPFX_ESP',
    stealth: 'SPFX_STLTH', regeneration: 'SPFX_REGEN', teleportControl: 'SPFX_TCTRL',
    warnOfMonster: 'SPFX_WARN', warning: 'SPFX_WARN', energyRegeneration: 'SPFX_EREGEN',
    halfSpellDamage: 'SPFX_HSPDAM', halfPhysicalDamage: 'SPFX_HPHDAM', reflection: 'SPFX_REFLECT',
};

export function whatGives(property: PropertyName, state: GameState = game): GameObject | null {
    const wornmask = W_ARM | W_ARMC | W_ARMH | W_ARMS | W_ARMG | W_ARMF | W_ARMU
        | W_AMUL | W_RINGL | W_RINGR | W_TOOL | W_ART | W_ARTI
        | (state.u.twoweap ? W_SWAPWEP : 0);
    const extrinsic = extrinsicPropertyMask(property, state);
    const wornbits = wornmask & extrinsic;
    for (const object of state.inventory) {
        if (object.oartifact && (property !== 'warnOfMonster' || state.context.warntype?.obj)) {
            const artifact = artifactById(object.oartifact, state);
            if (!artifact) continue;
            const defense = DEFENSES[property];
            const flag = FLAGS[property];
            if (defense && (artifact.carriedDefense === defense
                || artifact.defense === defense && ((object.owornmask ?? 0) & ~(W_ART | W_ARTI))))
                return object;
            if (flag && (artifact.carriedFlags.includes(flag)
                || artifact.flags.includes(flag) && object.owornmask)) return object;
            if (object === state.uwep && property === 'blindResistance' && (extrinsic & W_WEP)) return object;
        } else if (wornbits && wornbits === (wornmask & (object.owornmask ?? 0))) return object;
    }
    return null;
}
