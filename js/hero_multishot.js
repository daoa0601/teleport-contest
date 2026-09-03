// How many objects the hero throws or shoots with one command.
// C refs: dothrow.c multishot_class_bonus() and throw_obj().

import { artifactById } from './artifacts.js';
import { currentAttribute } from './attrib.js';
import {
    A_DEX, A_STR, P_CROSSBOW, P_DAGGER, P_DART, P_EXPERT, P_KNIFE,
    P_SHURIKEN, P_SKILLED, P_SLING, P_SPEAR,
} from './const.js';
import { game } from './gstate.js';
import {
    ELVEN_ARROW, ELVEN_BOW, OBJECT_SUBTYPE, ORCISH_ARROW, ORCISH_BOW,
    YA, YUMI,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import {
    isLauncherAmmunition, launcherMatchesAmmo,
} from './object_properties.js';
import { rnd } from './rng.js';
import { ensureHeroSkills } from './skills.js';

const WEAPON_CLASS = 2;

function heroRole(state) {
    return String(state.urole?.key || state.urole?.name || '').toLowerCase();
}

function heroRace(state) {
    return String(
        state.urace?.key || state.urace?.noun || state.urace?.name || 'human',
    ).toLowerCase();
}

function weakMultishot(role, skill, state) {
    return role === 'wizard' || role === 'priest'
        || (role === 'healer' && skill !== P_KNIFE)
        || (role === 'tourist' && skill !== -P_DART)
        || state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0
        || currentAttribute(A_DEX, state) <= 6;
}

function roleBonus(role, item, launcher, skill) {
    if (role === 'caveman')
        return skill === -P_SLING || skill === P_SPEAR ? 1 : 0;
    if (role === 'monk') return skill === -P_SHURIKEN ? 1 : 0;
    if (role === 'ranger') return skill !== P_DAGGER ? 1 : 0;
    if (role === 'rogue') return skill === P_DAGGER ? 1 : 0;
    if (role === 'ninja') {
        return (skill === -P_SHURIKEN || skill === -P_DART ? 1 : 0)
            + (item.otyp === YA && launcher?.otyp === YUMI ? 1 : 0);
    }
    if (role === 'samurai')
        return item.otyp === YA && launcher?.otyp === YUMI ? 1 : 0;
    return 0;
}

function raceBonus(race, item, launcher, skill) {
    if (race === 'elf') {
        return item.otyp === ELVEN_ARROW && launcher?.otyp === ELVEN_BOW
            ? 1 : 0;
    }
    if (race === 'orc') {
        return item.otyp === ORCISH_ARROW && launcher?.otyp === ORCISH_BOW
            ? 1 : 0;
    }
    return race === 'gnome' && skill === -P_CROSSBOW ? 1 : 0;
}

function questArtifactLauncher(launcher, state) {
    return !!(launcher?.questArtifact || launcher?.isQuestArtifact
        || artifactById(launcher?.oartifact, state)?.questArtifact);
}

export function chooseHeroVolleyCount(item, {
    state = game,
    shotLimit = 0,
    random = rnd,
} = {}) {
    const quantity = Math.max(1, item?.quan ?? item?.quantity ?? 1);
    const launcher = launcherMatchesAmmo(item, state.uwep)
        ? state.uwep : null;
    const objectClass = item?.oclass || objectClassForType(item?.otyp);
    const canVolley = quantity > 1
        && (isLauncherAmmunition(item) ? !!launcher
            : objectClass === WEAPON_CLASS)
        && !state.u?.confused && !(state.u?.confusionTurns > 0)
        && !state.u?.stunned && !(state.u?.stunnedTurns > 0);
    if (!canVolley) return 1;

    const skill = OBJECT_SUBTYPE[item.otyp] ?? 0;
    const skillLevel = ensureHeroSkills(state)?.[Math.abs(skill)]?.skill ?? 0;
    const role = heroRole(state);
    const race = heroRace(state);
    const weak = weakMultishot(role, skill, state);
    let maximum = 1;
    if (skillLevel >= P_EXPERT) maximum++;
    if (skillLevel >= P_SKILLED && !weak) maximum++;
    maximum += roleBonus(role, item, launcher, skill);
    if (!weak) {
        maximum += raceBonus(race, item, launcher, skill);
        if (questArtifactLauncher(launcher, state)) maximum++;
    }

    if (maximum > 1 && skill === -P_CROSSBOW
        && currentAttribute(A_STR, state) < (race === 'gnome' ? 16 : 18)) {
        maximum = random(maximum);
    }
    let count = Math.min(random(maximum), quantity);
    if (shotLimit > 0) count = Math.min(count, shotLimit);
    return count;
}
