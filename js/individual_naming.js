// Player inscriptions and artifact naming. C do_name.c:do_oname()/oname().
import { artifactByName, nameArtifact } from './artifacts.js';
import { heroHandName } from './body_parts.js';
import { PL_PSIZ, QBUFSZ } from './const.js';
import { displayMessageWindow, plineWithContinuation as pline } from './display.js';
import { wipeoutText } from './engrave.js';
import { recordGameLogEvent } from './gamelog.js';
import { game } from './gstate.js';
import { CLOAK_OF_DISPLACEMENT, CLOAK_OF_PROTECTION, HELMET, LEATHER_GLOVES, LEVITATION_BOOTS, OBJECT_BASES, OBJECT_DESCRIPTIONS, OBJECT_MAGIC, OBJECT_NAMES, OBJECT_UNIQUE, POT_WATER, SPEED_BOOTS, SPE_NOVEL, } from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import { objectName, objectNameIsPlural, observeObjectForNaming, simpleObjectName, simpleObjectNameWithArticle, } from './objnam.js';
import { getLine } from './query.js';
import { rn2Display } from './rng.js';
import { objectOwnershipPrefix, objectTypeKnown, updateUnpaidObjectPrice } from './shk.js';
import { setTwoWeaponCombat, setWieldedArtifactProperties } from './weapon_slots.js';
export async function nameIndividualObject(object) {
    if (object.otyp === SPE_NOVEL) {
        await pline(`${objectOwnershipPrefix(object)}${simpleObjectName(object)} already has a published name.`);
        return;
    }
    observeObjectForNaming(object);
    const prefix = `What do you want to name ${objectNameIsPlural(object) ? 'these' : 'this'} `;
    let description = objectName(object);
    if (prefix.length + description.length + 1 >= QBUFSZ)
        description = simpleObjectName(object);
    if (prefix.length + description.length + 1 >= QBUFSZ)
        description = 'item';
    const name = await playerName(`${prefix}${description}?`);
    if (name === null)
        return;
    if (object.oartifact) {
        await pline(`${object.oextra?.oname || object.oname || 'The artifact'} resists the attempt.`);
        return;
    }
    const artifact = artifactByName(name);
    let inscription = name;
    if (artifact && (restrictedArtifactName(object, artifact)
        || artifact.baseType === object.otyp && game._artifactExists?.has(artifact.id))) {
        inscription = artifact.name;
        const start = /^the /i.test(inscription) ? inscription.slice(0, 4) : '';
        do {
            inscription = start + wipeoutText(artifact.name.slice(start.length), rn2Display(2) + 1);
        } while (inscription === artifact.name);
        await pline(`While engraving, your ${heroHandName(game)} slips.`);
        await displayMessageWindow();
        await pline(`You engrave: "${inscription}".`);
        const conduct = (game.u.uconduct ??= {});
        conduct.literate = (conduct.literate ?? 0) + 1;
    }
    else if (artifact?.baseType === object.otyp) {
        inscription = artifact.name;
    }
    delete object.oname;
    if (inscription) {
        object.oextra = { ...object.oextra, oname: inscription };
    }
    else if (object.oextra) {
        delete object.oextra.oname;
    }
    if (!artifact || artifact.baseType !== object.otyp || inscription !== artifact.name)
        return;
    if (!nameArtifact(object, artifact, { knownOrigin: true }))
        return;
    if (object === (game.uswapwep || game.u.uswapwep)) {
        if (game.u.twoweap)
            await pline('You can no longer wield two weapons at once.');
        setTwoWeaponCombat(false);
    }
    if (object === (game.uwep || game.u.uwep))
        await setWieldedArtifactProperties(object, true, game);
    if (object.unpaid)
        updateUnpaidObjectPrice(object);
    const conduct = (game.u.uconduct ??= {});
    const first = !conduct.literate;
    conduct.literate = (conduct.literate ?? 0) + 1;
    const bareName = artifact.name.replace(/^the /i, '');
    recordGameLogEvent(first ? `became literate by naming ${bareName}`
        : `chose ${simpleObjectNameWithArticle(object)} to be named "${bareName}"`);
}
// Empty input cancels; spaces erase a name after normalization.
export async function playerName(prompt) {
    const input = await getLine(prompt, (_ch, key) => key >= 32 && key < 127);
    return input === null || input === '' ? null
        : input.trim().replace(/\s+/g, ' ').slice(0, PL_PSIZ - 1);
}
function restrictedArtifactName(object, artifact) {
    if (!(artifact.restricted || artifact.noGeneration || object.quan > 1))
        return false;
    if (object.otyp === artifact.baseType)
        return true;
    if (objectTypeKnown(object) || objectTypeKnown({ otyp: artifact.baseType }))
        return false;
    if (object.oclass !== objectClassForType(artifact.baseType))
        return false;
    const description = game.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
    const other = game.objectDescriptions?.[artifact.baseType] ?? OBJECT_DESCRIPTIONS[artifact.baseType];
    if (!description || !other)
        return false;
    const [low, high] = appearanceRange(object);
    return description === other || artifact.baseType >= low && artifact.baseType <= high;
}
// o_init.c:obj_shuffle_range(), including its fixed-description exceptions.
function appearanceRange(object) {
    const type = object.otyp;
    const armorRanges = [
        [HELMET, OBJECT_NAMES.indexOf('helm of telepathy')],
        [LEATHER_GLOVES, OBJECT_NAMES.indexOf('gauntlets of dexterity')],
        [CLOAK_OF_PROTECTION, CLOAK_OF_DISPLACEMENT], [SPEED_BOOTS, LEVITATION_BOOTS],
    ];
    if (object.oclass === 3) {
        for (const [low, high] of armorRanges)
            if (low !== undefined && high !== undefined && type >= low && type <= high)
                return [low, high];
    }
    let low = OBJECT_BASES[object.oclass] ?? type;
    let high = (OBJECT_BASES[object.oclass + 1] ?? type + 1) - 1;
    if (object.oclass === 8)
        high = POT_WATER - 1;
    else if ([5, 9, 10].includes(object.oclass)) {
        high = low;
        while (objectClassForType(high) === object.oclass
            && !OBJECT_UNIQUE[high] && OBJECT_MAGIC[high])
            high++;
        high--;
    }
    else if (![4, 11, 17].includes(object.oclass)) {
        low = high = type;
    }
    return type >= low && type <= high ? [low, high] : [type, type];
}
//# sourceMappingURL=individual_naming.js.map