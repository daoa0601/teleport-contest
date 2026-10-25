// Native objnam.c:doname_base(). Inventory and floor feedback share the same
// knowledge, quantities, physical state, equipment annotations, and prices.
// Callers observe the object separately before formatting it.
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { artifactByName } from './artifacts.js';
import { isContainer } from './container.js';
import { BUFSZ, MV_KNOWS_EGG } from './const.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    AMULET_OF_YENDOR, BAG_OF_TRICKS, CHEST, CORPSE, CRYSKNIFE, EGG,
    FAKE_AMULET_OF_YENDOR, GOLD_PIECE, HORN_OF_PLENTY, LARGE_BOX,
    OBJECT_NAMES, OBJECT_CHARGED, OBJECT_UNIQUE, POT_WATER, SLIME_MOLD, STATUE,
} from './object_data.js';
import { objectClassDescription } from './object_description_details.js';
import { objectDescriptionPrice } from './object_description_price.js';
import { heldObjectDescription, primaryHandDescriptionDetail, wornObjectDescription } from './object_equipment_description.js';
import { erosionMatters, objectIsVulnerableToErosion } from './object_erosion.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { isWeaponTool } from './object_properties.js';
import { corpseName, objectHasPersonalName, objectName, pluralizeObjectNoun } from './objnam.js';
import { objectTypeKnown } from './shk.js';

export interface ObjectDescriptionOptions {
    state?: GameState;
    withPrice?: boolean;
    primaryHandDetail?: string | null;
    projectPrimaryHand?: boolean;
    vagueQuantity?: boolean;
}

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;

// C objnam.c:paydoname(). Billing hides contents, weights, and the usual
// inventory price; the payment menu supplies its own price column.
export async function paymentObjectDescription(object: GameObject, quantity: number, {
    state = game, purchasingContents = false,
}: { state?: GameState; purchasingContents?: boolean } = {}): Promise<string> {
    const { quan, cknown } = object;
    const { wizweight, suppress_price } = state.iflags;
    const hasContents = !!object.contents?.length;
    object.quan = quantity;
    if (hasContents) object.cknown = false;
    state.iflags.wizweight = false;
    state.iflags.suppress_price = true;
    try {
        let name = await objectDescription(object, { state });
        if (hasContents) {
            if (!object.no_charge && !(purchasingContents && object.unpaid))
                name = `${object.unpaid ? 'an unpaid' : 'your'} ${name.replace(/^an? /, '')}`;
            name = object.unpaid ? `${name} and its contents` : `the contents of ${name}`;
        }
        return name;
    } finally {
        object.quan = quan;
        if (cknown === undefined) delete object.cknown;
        else object.cknown = cknown;
        if (wizweight === undefined) delete state.iflags.wizweight;
        else state.iflags.wizweight = wizweight;
        if (suppress_price === undefined) delete state.iflags.suppress_price;
        else state.iflags.suppress_price = suppress_price;
    }
}

export async function objectDescription(object: GameObject, {
    state = game, withPrice = false, primaryHandDetail, projectPrimaryHand = false,
    vagueQuantity = false,
}: ObjectDescriptionOptions = {}): Promise<string> {
    let noun = objectName(object, state);
    const poisoned = !!object.opoisoned && noun.startsWith('poisoned ');
    if (poisoned) noun = noun.slice(9);
    const override = !!(state.iflags.override_ID || object.overrideIdentified);
    const quantity = vagueQuantity && !object.dknown && !override ? 'some' : String(object.quan);
    const known = object.known || override;
    const contentsKnown = object.cknown || override;
    const prefix: string[] = [];
    const chargedContainer = object.otyp === BAG_OF_TRICKS || object.otyp === HORN_OF_PLENTY;
    if (contentsKnown && (chargedContainer ? object.spe === 0 && !known
        : (isContainer(object) || object.otyp === STATUE) && !object.contents?.length))
        prefix.push('empty');
    const blessing = objectBlessingDescription(object, state);
    if (blessing) prefix.push(blessing);
    if (object.otyp === CHEST || object.otyp === LARGE_BOX) {
        if (object.otrapped && object.tknown && object.dknown) prefix.push('trapped');
        if (object.lknown || override)
            prefix.push(object.obroken ? 'broken' : object.olocked ? 'locked' : 'unlocked');
    }
    if (object.greased) prefix.push('greased');
    if (poisoned && (object.oclass === WEAPON_CLASS || object.oclass === ARMOR_CLASS
        || isWeaponTool(object))) prefix.push('poisoned');
    prefix.push(...erosionDescription(object, state));
    if (known && (object.oclass === WEAPON_CLASS || object.oclass === ARMOR_CLASS || isWeaponTool(object)
        || object.oclass === RING_CLASS && OBJECT_CHARGED[object.otyp]))
        prefix.push(`${object.spe >= 0 ? '+' : ''}${object.spe}`);
    const details = await objectClassDescription(object, state);
    prefix.push(...details.prefix);

    if (object.quan !== 1) noun = pluralizeObjectNoun(object, noun);
    let description: string;
    if (object.otyp === CORPSE) {
        description = corpseName(object, {
            adjective: [...(object.quan !== 1 ? [quantity] : []), ...prefix].join(' '),
            includeArticle: object.quan === 1,
        }) + noun.replace(/^corpses?/, '');
    } else {
        if (object.otyp === EGG && object.corpsenm !== undefined && eggHasMonsterSpecies(object)
            && (known || ((state.mvitals?.[object.corpsenm]?.mvflags ?? 0) & MV_KNOWS_EGG)))
            prefix.push(MONSTER_NAME[object.corpsenm] ?? '');
        description = [...prefix, noun].join(' ');
        const fruitArtifact = object.otyp === SLIME_MOLD ? artifactByName(noun, state) : null;
        if (object.quan !== 1) description = `${quantity} ${description}`;
        else if (objectHasPersonalName(object, state) || uniqueObject(object, state)
            || fruitArtifact?.name.toLowerCase().startsWith('the '))
            description = `the ${description.replace(/^the /i, '')}`;
        else if (!fruitArtifact) description = withIndefiniteArticle(description);
    }
    if (contentsKnown && object.contents?.length) {
        const count = object.contents.length;
        description += ` containing ${count} item${count === 1 ? '' : 's'}`;
    }
    description += wornObjectDescription(object, state) + details.suffix;
    const handDetail = primaryHandDetail === undefined
        ? primaryHandDescriptionDetail(object, state) : primaryHandDetail;
    description += heldObjectDescription(object, { state, primaryHandDetail: handDetail, projectPrimaryHand });
    description += await objectDescriptionPrice(object, { state, withPrice });
    if (state.flags.debug && state.iflags.wizweight) {
        description = withPrice && description.endsWith(')')
            ? `${description.slice(0, -1)}, ${object.owt} aum)`
            : `${description} (${object.owt} aum)`;
    }
    return description.slice(0, BUFSZ - 1);
}

export function objectBlessingDescription(object: GameObject, state: GameState = game): string | null {
    const override = state.iflags.override_ID || object.overrideIdentified;
    if ((!object.bknown && !override) || object.otyp === GOLD_PIECE) return null;
    if (object.otyp === POT_WATER && objectTypeKnown(object, state)
        && (object.blessed || object.cursed)) return null;
    if (object.cursed) return 'cursed';
    if (object.blessed) return 'blessed';
    const SCROLL_OF_MAIL = OBJECT_NAMES.indexOf('mail');
    const retainsUncursed = (!(object.known || override) || !OBJECT_CHARGED[object.otyp]
        || object.oclass === ARMOR_CLASS || object.oclass === RING_CLASS)
        && object.otyp !== SCROLL_OF_MAIL
        && object.otyp !== FAKE_AMULET_OF_YENDOR && object.otyp !== AMULET_OF_YENDOR
        && state.urole?.key !== 'priest';
    return state.flags.implicit_uncursed === false || retainsUncursed ? 'uncursed' : null;
}

function uniqueObject(object: GameObject, state: GameState): boolean {
    const override = state.iflags.override_ID || object.overrideIdentified;
    if (!object.dknown && !override) return false;
    if (object.otyp === FAKE_AMULET_OF_YENDOR && !object.known && !override) return true;
    return !!OBJECT_UNIQUE[object.otyp]
        && (object.known || !!override || object.otyp === AMULET_OF_YENDOR);
}

function erosionDescription(object: GameObject, state: GameState): string[] {
    if (!erosionMatters(object)) return [];
    const fixedKnife = object.otyp === CRYSKNIFE;
    const rusty = objectIsVulnerableToErosion(object, 'rust', state);
    const cracked = objectIsVulnerableToErosion(object, 'crack', state);
    const corroded = objectIsVulnerableToErosion(object, 'corrosion', state);
    const burnt = objectIsVulnerableToErosion(object, 'burn', state);
    const rotted = objectIsVulnerableToErosion(object, 'rot', state);
    if (!fixedKnife && !rusty && !cracked && !corroded && !burnt && !rotted) return [];
    const words: string[] = [];
    if (!fixedKnife && object.oeroded)
        words.push(erosionDegree(object.oeroded) + (rusty ? 'rusty' : cracked ? 'cracked' : 'burnt'));
    if (!fixedKnife && object.oeroded2)
        words.push(erosionDegree(object.oeroded2) + (corroded ? 'corroded' : 'rotted'));
    if ((object.rknown || object.overrideIdentified || state.iflags.override_ID) && object.oerodeproof) {
        const proof = fixedKnife ? 'fixed' : rusty ? 'rustproof' : corroded ? 'corrodeproof'
            : burnt ? 'fireproof' : cracked ? 'tempered' : rotted ? 'rotproof' : '';
        if (proof) words.push(proof);
    }
    return words;
}

function erosionDegree(level: number): string {
    return level === 2 ? 'very ' : level === 3 ? 'thoroughly ' : '';
}
