// C artifact.c:set_artifact_intrinsic(). Each artifact contributes its own
// property source, so removing one item preserves other carried sources.
import { artifactById } from './artifacts.js';
import type { Artifact } from './artifacts.js';
import type { ArtifactDefense, ArtifactFlag } from './data_types.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import { see_monsters } from './display.js';
import { game } from './gstate.js';
import { OBJECT_PROPERTY } from './object_data.js';
import {
    grantWornProperty, hasCarriedProperty, removeWornProperty, setCarriedProperty,
} from './properties.js';

const DEFENSE_PROPERTIES: Partial<Record<ArtifactDefense, PropertyName>> = {
    fire: 'fireResistance', cold: 'coldResistance', magic: 'antimagic',
    poison: 'poisonResistance', 'life-drain': 'drainResistance',
};
const FLAG_PROPERTIES: readonly (readonly [ArtifactFlag, PropertyName])[] = [
    ['SPFX_SEARCH', 'searching'], ['SPFX_ESP', 'telepathy'],
    ['SPFX_STLTH', 'stealth'], ['SPFX_REGEN', 'regeneration'],
    ['SPFX_TCTRL', 'teleportControl'], ['SPFX_EREGEN', 'energyRegeneration'],
    ['SPFX_HSPDAM', 'halfSpellDamage'], ['SPFX_HPHDAM', 'halfPhysicalDamage'],
    ['SPFX_PROTECT', 'protection'],
];

function conferredProperties(artifact: Artifact, carried: boolean): PropertyName[] {
    const flags = carried ? artifact.carriedFlags : artifact.flags;
    const defense = carried ? artifact.carriedDefense : artifact.defense;
    const properties: PropertyName[] = [];
    const resistance = defense && DEFENSE_PROPERTIES[defense];
    if (resistance) properties.push(resistance);
    for (const [flag, property] of FLAG_PROPERTIES)
        if (flags.includes(flag)) properties.push(property);
    if (flags.includes('SPFX_WARN') && artifact.target.kind !== 'flag2')
        properties.push('warning');
    return properties;
}

export async function setCarriedArtifactProperties(
    object: GameObject, active: boolean, state: GameState = game,
): Promise<void> {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) return;
    for (const property of conferredProperties(artifact, true))
        setCarriedProperty(property, object, active, state);
    if (artifact.carriedFlags.includes('SPFX_ESP')
        && (active || !hasCarriedProperty('telepathy', null, state))) {
        recalculateArtifactTelepathyRange(state);
        await see_monsters();
    }
}

export function setWornArtifactProperties(
    object: GameObject, slot: WornPropertySlot, active: boolean, state: GameState = game,
): void {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) return;
    const properties = conferredProperties(artifact, false);
    if (slot === 'uwep') {
        if (artifact.flags.includes('SPFX_REFLECT')) properties.push('reflection');
        if (artifact.enumName === 'SUNSWORD') properties.push('blindResistance');
    }
    for (const property of properties) {
        if (active) grantWornProperty(property, object, slot, state);
        else removeWornProperty(property, object, slot, state);
    }
    if (artifact.flags.includes('SPFX_XRAY')) {
        state.u.xray_range = active ? 3 : -1;
        state.vision_full_recalc = 1;
    }
}

// worn.c counts all ordinary worn TELEPAT objects, plus one source for
// every carried ESP artifact together, regardless of their number.
function recalculateArtifactTelepathyRange(state: GameState): void {
    const worn = [state.uarm, state.uarmc, state.uarmh, state.uarms,
        state.uarmg, state.uarmf, state.uarmu, state.uamul, state.uleft,
        state.uright, state.ublindf, state.uwep, state.uswapwep, state.uquiver];
    const ordinary = worn.filter(object => object
        && OBJECT_PROPERTY[object.otyp] === 'telepathy').length;
    const sources = ordinary + Number(hasCarriedProperty('telepathy', null, state));
    state.u.unblind_telepat_range = sources ? 64 * sources : -1;
}
