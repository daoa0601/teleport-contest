// Player inscriptions and artifact naming. C do_name.c:do_oname()/oname().
import { artifactByName, nameArtifact } from './artifacts.js';
import { heroHandName } from './body_parts.js';
import { QBUFSZ } from './const.js';
import { displayMessageWindow, plineWithContinuation as pline } from './display.js';
import { wipeoutText } from './engrave.js';
import { recordGameLogEvent } from './gamelog.js';
import { game } from './gstate.js';
import { CLOAK_OF_DISPLACEMENT, CLOAK_OF_PROTECTION, HELMET, LEATHER_GLOVES, LEVITATION_BOOTS, OBJECT_BASES, OBJECT_DESCRIPTIONS, OBJECT_MAGIC, OBJECT_NAMES, OBJECT_UNIQUE, POT_WATER, SPEED_BOOTS, SPE_NOVEL, } from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import { objectName, objectNameIsPlural, observeObjectForNaming, pluralizeObjectNoun, simpleObjectName, simpleObjectNameWithArticle, } from './objnam.js';
import { playerName } from './player_name.js';
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
    const suffix = '?';
    const description = individualNamingDescription(object, QBUFSZ - 1 - prefix.length - suffix.length);
    const name = await playerName(`${prefix}${description}${suffix}`);
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
    if (!nameArtifact(object, artifact, { origin: 'named', knownOrigin: true }))
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
// C safe_qbuf()/short_oname(xname, simpleonames): keep as much of each
// existing name as fits, without changing the names the player can edit.
function individualNamingDescription(object, limit) {
    const describe = (item, state = game) => {
        const name = objectName(item, state);
        return item.quan === 1 ? name : pluralizeObjectNoun(item, name);
    };
    let name = describe(object);
    if (name.length <= limit)
        return name;
    const callName = game._objectCallNames?.[object.otyp];
    const personalName = object.oextra?.oname || object.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...game, _objectCallNames: {
                ...game._objectCallNames, [object.otyp]: `${callName.slice(0, 8)}...`,
            } } : game;
    const shortNamedObject = personalName && personalName.length >= 12
        ? { ...object, oextra: { ...object.oextra, oname: `${personalName.slice(0, 8)}...` } }
        : object;
    if (shortCallState !== game) {
        name = describe(object, shortCallState);
        if (name.length <= limit)
            return name;
    }
    if (shortNamedObject !== object) {
        name = describe(shortNamedObject);
        if (name.length <= limit)
            return name;
    }
    const shortenBoth = shortCallState !== game && shortNamedObject !== object;
    if (shortenBoth) {
        name = describe(shortNamedObject, shortCallState);
        if (name.length <= limit)
            return name;
    }
    // Only the combined attempt leaves both names abbreviated when native
    // removes attributes. Erosion aliases share the cleared C fields.
    const state = shortenBoth ? shortCallState : game;
    const plainObject = { ...(shortenBoth ? shortNamedObject : object),
        bknown: game.urole?.key === 'priest', rknown: false, greased: false,
        oeroded: 0, oeroded2: 0, orotten: false, odiluted: false, norevive: false,
    };
    name = describe(plainObject, state);
    if (name.length > limit)
        name = simpleObjectName(plainObject, state);
    return name.length <= limit ? name : 'item';
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