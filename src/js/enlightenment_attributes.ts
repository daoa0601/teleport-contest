// C insight.c:attributes_enlightenment(). Property order is the native order.
import { objectMaterial } from './object_material.js';
import { game } from './gstate.js';
import { canPraySafely } from './pray.js';
import { deityName } from './alignment.js';
import { magicNegation } from './magic_negation.js';
import { simpleArmorName } from './armor.js';
import { confersLuck } from './hero_inventory.js';
import { fromWhat, extrinsicPropertyMask, intrinsicPropertyMask, veryFast } from './attribute_provenance.js';
import { hasPermanentIntrinsicProperty, propertyIsActive, propertyIsBlocked, propertyTimeout } from './properties.js';
import { blindnessBlocked, blindfolded, heroIsBlind, permanentBlind } from './senses.js';
import { heroHatesSilver, heroIsAmphibious, heroIsBreathless, heroPassesWalls } from './hero_species.js';
import { MONSTER_FLAGS1, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { isLavaAt, isPoolAt, levelHasCeiling } from './terrain_properties.js';
import { minimalObjectName } from './objnam.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import {
    DWARVISH_CLOAK, LUCKSTONE, OBJECT_PROPERTY,
    RIN_PROTECTION, AMULET_OF_GUARDING, ROBE, TOWEL,
} from './object_data.js';
import { TIMEOUT, TT_PIT, Upolyd,
    W_ARMOR, W_ACCESSORY, W_WEP, W_ART } from './const.js';
import type { PropertyName } from './property_types.js';

export type EnlightenmentFinal = 0 | 1 | 2;
interface PiousnessOptions { showNegative?: boolean; suffix?: string }

export function piousness(record: number, { showNegative = true, suffix = '' }: PiousnessOptions = {}) {
    const description = record >= 20 ? 'piously' : record > 13 ? 'devoutly'
        : record > 8 ? 'fervently' : record > 3 ? 'stridently'
        : record === 3 ? '' : record > 0 ? 'haltingly'
        : record === 0 ? 'nominally' : !showNegative ? 'insufficiently' : record >= -3 ? 'strayed'
        : record >= -8 ? 'sinned' : 'transgressed';
    return suffix && (!showNegative || record >= 0)
        ? `${description}${record === 3 ? '' : ' '}${suffix}` : description;
}

export function attributeEnlightenmentLines(final: EnlightenmentFinal = 0): string[] {
    const u = game.u;
    const wizard = !!game.flags.debug;
    const underwater = !!u.uinwater;
    const lines: string[] = ['', ` ${final ? 'Final ' : ''}Attributes:`];
    const message = (subject: string, present: string, past: string, what: string, suffix = '') =>
        lines.push(contractEnlightenment(`  ${subject}${final ? past : present}${what}${suffix}.`));
    const are = (what: string, property?: PropertyName, blocked = false) =>
        message('You ', 'are ', 'were ', what, property ? fromWhat(property, game, blocked) : '');
    const have = (what: string, property?: PropertyName) =>
        message('You ', 'have ', 'had ', what, property ? fromWhat(property) : '');
    const can = (what: string, property?: PropertyName) =>
        message('You ', 'can ', 'could ', what, property ? fromWhat(property) : '');
    const active = (property: PropertyName) => propertyIsActive(property)
        || (property !== 'invulnerable' && !!u[property]);

    const honor = u.uevent?.uhand_of_elbereth;
    const honorTitle = honor && ['the Hand of Elbereth', 'the Envoy of Balance', 'the Glory of Arioch'][honor - 1];
    if (honorTitle) are(honorTitle);
    const record = u.ualign?.record ?? 0;
    const devotion = piousness(record, { suffix: 'aligned' });
    if (record >= 0) are(devotion);
    else have(devotion);
    if (wizard) message('Your alignment ', 'is ', 'was ', String(record));

    if (intrinsicPropertyMask('invulnerable')) are('invulnerable', 'invulnerable');
    if (active('antimagic') || u.magicProtection) are('magic-protected', 'antimagic');
    if (active('fireResistance')) are('fire resistant', 'fireResistance');
    lines.push(...itemResistanceLines('fireResistance', 'fire', final));
    if (active('coldResistance')) are('cold resistant', 'coldResistance');
    lines.push(...itemResistanceLines('coldResistance', 'cold', final));
    if (active('sleepResistance')) are('sleep resistant', 'sleepResistance');
    if (active('disintegrationResistance')) are('disintegration resistant', 'disintegrationResistance');
    lines.push(...itemResistanceLines('disintegrationResistance', 'disintegration', final));
    if (active('shockResistance')) are('shock resistant', 'shockResistance');
    lines.push(...itemResistanceLines('shockResistance', 'electric shocks', final));
    if (active('poisonResistance')) are('poison resistant', 'poisonResistance');
    const temporaryResistance = (property: PropertyName) =>
        propertyTimeout(property) && !(intrinsicPropertyMask(property) & ~TIMEOUT)
            && !extrinsicPropertyMask(property) && !propertyIsBlocked(property) ? 'temporarily ' : '';
    if (active('acidResistance')) are(`${temporaryResistance('acidResistance')}acid resistant`, 'acidResistance');
    lines.push(...itemResistanceLines('acidResistance', 'acid', final));
    if (active('drainResistance')) are('level-drain resistant', 'drainResistance');
    if (active('sicknessResistance')) are('immune to sickness', 'sicknessResistance');
    if (active('stoneResistance')) are(`${temporaryResistance('stoneResistance')}petrification resistant`, 'stoneResistance');
    if (active('hallucinationResistance')) message('You ', 'resist', 'resisted', ' hallucinations', fromWhat('hallucinationResistance'));
    if (u.uedibility) can('recognize detrimental food');

    if ((intrinsicPropertyMask('blinded') || blindfolded()) && blindnessBlocked())
        message('You ', 'can ', 'could ', 'see', fromWhat('blinded', game, true));
    if (active('blindResistance') && !heroIsBlind()) are('not subject to light-induced blindness', 'blindResistance');
    if (active('seeInvisible')) {
        if (!heroIsBlind()) message('You ', 'see', 'saw', ' invisible', fromWhat('seeInvisible'));
        else message('You ', permanentBlind() ? 'would see' : 'will see', 'would have seen',
            ` invisible ${permanentBlind() ? 'if' : 'when'} not blind`);
    }
    if (active('telepathy')) are('telepathic', 'telepathy');
    if (active('warning')) are('warned', 'warning');
    const warning = game.context.warntype;
    if (active('warnOfMonster') && warning) {
        if (warning.obj) are(`aware of the presence of ${warningPeople(warning.obj, false)}`, 'warnOfMonster');
        if (warning.polyd) are(`aware of the presence of ${warningPeople(warning.polyd, true)}`);
        const species = MONSTER_NAME[warning.speciesidx ?? -1];
        if (species) are(`aware of the presence of ${makePlural(species)}`, 'warnOfMonster');
    }
    if (intrinsicPropertyMask('warnUndead')) are('warned of undead', 'warnUndead');
    if (active('searching')) have('automatic searching', 'searching');
    if (propertyIsActive('clairvoyant')) are('clairvoyant', 'clairvoyant');
    else if ((intrinsicPropertyMask('clairvoyant') || extrinsicPropertyMask('clairvoyant')) && propertyIsBlocked('clairvoyant'))
        message('You ', 'could be', 'could have been', ' clairvoyant', fromWhat('clairvoyant', game, true).replace(' because of ', ' if not for '));
    if (active('infravision')) have('infravision', 'infravision');
    if (active('detectMonsters')) {
        const timeout = propertyTimeout('detectMonsters');
        are(`sensing the presence of monsters${wizard && timeout ? ` (${timeout})` : ''}`);
    }
    if (u.umconf) {
        const hits = wizard && !final ? u.umconf === 1 ? ' (next hit only)' : ` (next ${u.umconf} hits)` : '';
        message('You ', 'will confuse', 'would have confused', ` monsters when hitting them${hits}`);
    }

    if (extrinsicPropertyMask('adorned')) {
        const adorn = [game.uleft, game.uright].reduce((sum, ring) =>
            sum + (ring && OBJECT_PROPERTY[ring.otyp] === 'adorned' ? ring.spe ?? 0 : 0), 0);
        are(`${adorn > 0 ? 'more ' : adorn < 0 ? 'less ' : ''}charismatic`, 'adorned');
    }
    if (propertyIsActive('invisible') || u.invisible || u.invis) {
        are(active('seeInvisible') ? 'invisible to others' : 'invisible', 'invisible');
    } else if ((intrinsicPropertyMask('invisible') || extrinsicPropertyMask('invisible')) && propertyIsBlocked('invisible'))
        are('visible', 'invisible', true);
    if (active('displaced')) are('displaced', 'displaced');
    if (propertyIsActive('stealth')) are('stealthy', 'stealth');
    else if (intrinsicPropertyMask('stealth') || extrinsicPropertyMask('stealth'))
        message('You ', 'would be', 'would have been', ` stealthy${u.usteed ? ' if not mounted' : ''}`);
    if (active('aggravateMonster')) message('You aggravate', '', 'd', ' monsters', fromWhat('aggravateMonster'));
    if (active('conflict')) message('You cause', '', 'd', ' conflict', fromWhat('conflict'));

    if (active('jumping')) can('jump', 'jumping');
    if (active('teleportation')) can('teleport', 'teleportation');
    if (active('teleportControl')) have('teleport control', 'teleportControl');
    const trapped = (u.utrap ?? 0) > 0 && u.utraptype !== TT_PIT;
    const levitationSources = intrinsicPropertyMask('levitation') || extrinsicPropertyMask('levitation');
    const levitationTerrain = u._propertySources?.levitation?.blockedByTerrain;
    if (levitationSources && (trapped || levitationTerrain))
        message('You ', 'would levitate', 'would have levitated',
            `${trapped ? ' if not trapped' : ''}${trapped && levitationTerrain ? ' and' : ''}${levitationTerrain ? ' if surroundings permitted' : ''}`);
    const flightSources = intrinsicPropertyMask('flying') || extrinsicPropertyMask('flying')
        || !!((MONSTER_FLAGS1[u.usteed?.mnum ?? -1] ?? 0) & 0x01);
    if (flightSources && propertyIsBlocked('flying')) {
        const terrain = u._propertySources?.flying?.blockedByTerrain;
        const reason = propertyIsActive('levitation') ? " if you weren't levitating"
            : trapped && !terrain ? " if you weren't trapped"
                : terrain && !trapped ? ' if surroundings permitted' : ' if circumstances permitted';
        message('You ', 'would fly', 'would have flown', reason);
    }
    if ((MONSTER_FLAGS1[u.umonnum ?? -1] ?? 0) & 0x10) {
        const ceiling = levelHasCeiling();
        if (ceiling && !u.uinwater) can('cling to the ceiling');
        else message('You ', 'could cling', 'could have clung', ` to the ceiling if ${
            ceiling ? '' : 'there was one'}${!ceiling && u.uinwater ? ' and ' : ''}${
            u.uinwater ? underwater ? "you weren't underwater" : "you weren't in the water" : ''}`);
    }
    const walkingOnWater = !u.uinwater && !u.levitating && !u.flying && (isPoolAt(u.ux, u.uy) || isLavaAt(u.ux, u.uy));
    if (active('waterWalking') && !walkingOnWater) can('walk on water', 'waterWalking');
    if (active('swimming') && (underwater || !u.uinwater)) can('swim', 'swimming');
    if (heroIsBreathless()) can('survive without air', 'magicalBreathing');
    else if (heroIsAmphibious()) can('breathe water', 'magicalBreathing');
    if (heroPassesWalls()) can('walk through walls', 'passesWalls');

    if (active('regeneration')) message('You regenerate', '', 'd', '', fromWhat('regeneration'));
    if (active('slowDigestion')) have('slower digestion', 'slowDigestion');
    if (u.uhitinc) {
        const penalty = monkArmorPenalty();
        const offset = !penalty ? '' : u.uhitinc < 0 ? 'increasing'
            : u.uhitinc < 4 * penalty / 5 ? 'partly offsetting'
                : u.uhitinc < penalty ? 'nearly offsetting' : 'overcoming';
        have(combatIncrement('to hit', u.uhitinc, final) + (offset ? ` ${offset} your suit's penalty` : ''));
    }
    if (u.udaminc) have(combatIncrement('damage', u.udaminc, final));
    if (u.uspellprot || active('protection')) {
        let protection = u.uspellprot ?? 0;
        for (const ring of [game.uleft, game.uright])
            if (ring?.otyp === RIN_PROTECTION) protection += ring.spe ?? 0;
        if (game.uamul?.otyp === AMULET_OF_GUARDING) protection += 2;
        if (hasPermanentIntrinsicProperty('protection')) protection += u.ublessed ?? 0;
        if (protection) have(combatIncrement('defense', protection, final));
    }
    const cancellation = magicNegation(u);
    const protection = ['', 'warded', 'guarded', 'protected'][Math.min(3, cancellation)];
    if (protection) are(protection);
    for (const [property, kind] of [['halfPhysicalDamage', 'physical'], ['halfSpellDamage', 'spell']] as const)
        if (active(property)) message('You ', 'take', 'took', ` ${final || wizard ? 'half' : 'reduced'} ${kind} damage`, fromWhat(property));
    const eyewear = game.ublindf || u.ublindf;
    if (eyewear?.otyp === TOWEL && (eyewear.spe ?? 0) > 0)
        message('You ', 'take', 'took', ' reduced poison gas damage');
    if (game.spells.length) {
        const metallic = game.uarm && objectMaterial(game.uarm.otyp) >= 11
            && objectMaterial(game.uarm.otyp) <= 17;
        const robe = game.uarmc?.otyp === ROBE;
        if (metallic || robe) message('Your spell casting ', 'is', 'was', metallic
            ? ` impaired by metallic armor${robe ? ', mitigated by your robe' : ''}` : ' enhanced by wearing a robe');
    }
    if (active('protectionFromShapeChangers')) are('protected from shape changers', 'protectionFromShapeChangers');
    const unchanging = active('unchanging');
    if (unchanging) {
        if (!Upolyd(u)) can('not change from your current form', 'unchanging');
        if (active('polymorph') || (u.ulycn ?? -1) >= 0) {
            const change = active('polymorph') ? 'polymorph' : 'change shape';
            message('You ', `would ${change}`, `would have ${change === 'polymorph' ? 'polymorphed' : 'changed shape'}`,
                ' periodically if not locked into your current form');
        }
    } else if (active('polymorph')) are('polymorphing periodically', 'polymorph');
    if (active('polymorphControl')) have('polymorph control', 'polymorphControl');
    const formName = monsterTypeName(u.umonnum ?? -1, !!game.flags.female);
    if (Upolyd(u) && u.umonnum !== u.ulycn && !(final === 2 && formName === 'green slime' && !unchanging)) {
        const vampire = (u.mcham ?? -1) >= 0 ? monsterTypeName(u.mcham ?? -1, !!game.flags.female) : null;
        are(`polymorphed into ${withIndefiniteArticle(vampire || formName || 'creature')}${
            vampire && vampire !== formName ? ` in ${formName} form` : ''}${wizard ? ` (${u.mtimedone})` : ''}`);
    }
    if (((MONSTER_FLAGS1[u.umonnum ?? -1] ?? 0) & 0x00400000) && game.flags.female) can('lay eggs');
    const lycanthrope = (u.ulycn ?? -1) >= 0 ? monsterTypeName(u.ulycn ?? -1, !!game.flags.female) : null;
    if (lycanthrope) are(`${withIndefiniteArticle(lycanthrope)}${u.umonnum === u.ulycn
        ? ` in beast form${wizard ? ` (${u.mtimedone})` : ''}` : ''}`);
    if (unchanging && Upolyd(u)) can('not change from your current form', 'unchanging');
    if (heroHatesSilver(game)) are('harmed by silver');
    if (active('fast')) are(veryFast() ? 'very fast' : 'fast', 'fast');
    if (active('reflection')) have('reflection', 'reflection');
    if (extrinsicPropertyMask('freeAction')) have('free action', 'freeAction');
    if (extrinsicPropertyMask('sustainAbility')) have('fixed abilities', 'sustainAbility');
    if (extrinsicPropertyMask('lifeSaving')) message('Your life ', 'will be', 'would have been', ' saved');

    // youprop.h Luck includes the luckstone/luck item bonus.
    const luck = (u.uluck ?? 0) + (u.moreluck ?? 0);
    if (luck) are(`${Math.abs(luck) >= 10 ? 'extremely ' : Math.abs(luck) >= 5 ? 'very ' : ''}${
        luck < 0 ? 'un' : ''}lucky${wizard ? ` (${luck})` : ''}`);
    else if (wizard) message('Your luck ', 'is', 'was', ' zero');
    if (u.moreluck) have(u.moreluck > 0 ? 'extra luck' : 'reduced luck');
    const stones = game.inventory.filter(object => confersLuck(object));
    const stoneLuck = stones.reduce((sum, object) => sum + (object.cursed ? -object.quan : object.quan), 0);
    if (stones.some(object => object.otyp === LUCKSTONE) || stoneLuck) {
        const blessedLuck = stones.reduce((sum, object) => sum + (object.cursed ? -object.quan : object.blessed ? object.quan : 0), 0);
        if (blessedLuck <= 0) message('Bad luck ', 'does', 'did', ' not time out for you');
        if (blessedLuck >= 0) message('Good luck ', 'does', 'did', ' not time out for you');
    }
    if (u.ugangr) message(deityName(u.ualign?.type ?? 0), ' is', ' was', ` ${u.ugangr > 6 ? 'extremely ' : u.ugangr > 3 ? 'very ' : ''}angry with you${wizard ? ` (${u.ugangr})` : ''}`);
    else if (!final) can(`${canPraySafely() ? '' : 'not '}safely pray${wizard ? ` (${u.ublesscnt ?? 0})` : ''}`);
    const mortality = u.umortality ?? 0;
    if (final === 2) lines.push(`  You are dead${mortality > 1 ? ` (${mortality}${ordinalSuffix(mortality)} time!)` : ''}.`);
    else if (mortality) lines.push(`  You ${final ? 'survived after being killed' : 'have been killed'} ${times(mortality)}.`);
    else if (final) lines.push('  You survived.');
    return lines;
}

function warningPeople(mask: number, form: boolean): string {
    if (form && (mask & 0x18) === 0x18) return 'humans and elves';
    if (form && (mask & 0x08)) return 'humans';
    if (!form && (mask & 0x80)) return 'orcs';
    if (mask & 0x10) return 'elves';
    if (form && (mask & 0x80)) return 'orcs';
    if (mask & 0x100) return 'demons';
    return form ? 'certain monsters' : 'something';
}

function itemResistanceLines(property: PropertyName, damage: string, final: EnlightenmentFinal): string[] {
    const mask = extrinsicPropertyMask(property);
    const extrinsic = !!(mask & (W_ARMOR | W_ACCESSORY | W_WEP | W_ART));
    const partial = !extrinsic && (property === 'fireResistance' || property === 'coldResistance')
        && game.uarmc?.otyp === DWARVISH_CLOAK;
    if (!extrinsic && !partial) return [];
    const cause = game.flags.debug ? itemResistanceCause(property) : '';
    return [`  Your items ${final ? 'were' : 'are'}${partial ? ' somewhat' : ''} protected from ${damage}${cause}.`];
}

function itemResistanceCause(property: PropertyName): string {
    const sources = game.u._propertySources?.[property]?.worn ?? [];
    for (const slot of ['uarmc', 'uarm', 'uarmu', 'uarmh', 'uarmg', 'uarmf', 'uarms'] as const) {
        const object = game[slot];
        if (object && sources.some(source => source.slot === slot)) return ` by your ${simpleArmorName(object, slot, game)}`;
    }
    for (const slot of ['uamul', 'ublindf', 'uleft', 'uright', 'uwep'] as const) {
        if (!sources.some(source => source.slot === slot)) continue;
        if ((slot === 'uleft' || slot === 'uright')
            && sources.some(source => source.slot === 'uleft') && sources.some(source => source.slot === 'uright')) return ' by your rings';
        const object = game[slot];
        if (object) return ` by your ${minimalObjectName(object)}`;
    }
    return '';
}

export function combatIncrement(kind: 'to hit' | 'damage' | 'defense', amount: number, final: EnlightenmentFinal): string {
    const magnitude = kind === 'defense' ? Math.trunc(Math.abs(amount) * 2 / 3) : Math.abs(amount);
    const size = magnitude <= 3 ? 'small' : magnitude <= 6 ? 'moderate' : magnitude <= 12 ? 'large' : 'huge';
    const bonus = amount >= 0 ? 'bonus' : 'penalty';
    return `${amount ? withIndefiniteArticle(size) : 'no'} ${kind === 'to hit' ? `${bonus} ${kind}` : `${kind} ${bonus}`}${
        final || game.flags.debug ? ` (${amount > 0 ? '+' : ''}${amount})` : ''}`;
}

function times(count: number): string {
    return count === 1 ? 'once' : count === 2 ? 'twice' : count === 3 ? 'thrice' : `${count} times`;
}

function ordinalSuffix(count: number): string {
    if (count % 100 >= 11 && count % 100 <= 13) return 'th';
    return count % 10 === 1 ? 'st' : count % 10 === 2 ? 'nd' : count % 10 === 3 ? 'rd' : 'th';
}

export function contractEnlightenment(line: string): string {
    return line.replace(' are not ', " aren't ").replace(' were not ', " weren't ")
        .replace(' have not ', " haven't ").replace(' had not ', " hadn't ")
        .replace(' can not ', " can't ").replace(' could not ', " couldn't ");
}

// worn.c:setworn() sets tux_penalty from these same live fields.
export function monkArmorPenalty(): number {
    return game.uarm && game.urole?.key === 'monk' && !Upolyd(game.u)
        ? game.urole.spellcasting.armor : 0;
}
