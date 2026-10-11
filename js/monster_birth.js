// Runtime completion of a monster birth.
// C refs: makemon.c:makemon(), pager.c:mhidden_description(), dochugw(FALSE).
import { BOLT_LIM, M_AP_F_DKNOWN, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, MM_NOMSG, MM_NOEXCLAM, } from './const.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, glyphAt, newsym, plineWithContinuation, } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { mkobj, mksobj } from './mklev.js';
import { monsterHasNoAttacks } from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterName } from './monster_name.js';
import { deallocateObject, stopObjectTimers } from './object_delete.js';
import { makePlural, verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { objectClassForType, observeObject } from './object_knowledge.js';
import { minimalObjectName } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { GOLD_PIECE, OBJECT_NAMES, SLIME_MOLD } from './object_data.js';
import { visibleRegionAt } from './regions.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { couldsee, monsterEmitsLight } from './vision.js';
export async function finishMonsterBirth(monster, flags = 0, state = game) {
    requireLiveGame(state);
    if (monsterEmitsLight(monster.mnum))
        state.vision_full_recalc = 1;
    if (state.in_mklev)
        return monster;
    newsym(monster.mx, monster.my);
    if (!(flags & MM_NOMSG)) {
        const appearance = M_AP_TYPE(monster);
        let exclaim = !(flags & MM_NOEXCLAM);
        let subject = null;
        if ((canSeeMonster(monster)
            && (appearance === M_AP_NOTHING || appearance === M_AP_MONSTER))
            || canSenseMonster(monster)) {
            subject = monsterName(monster, { article: 'a', capitalized: true, state });
            if (appearance === M_AP_MONSTER)
                exclaim = true;
        }
        else if (canSeeMonster(monster)) {
            const description = await disguisedBirthName(monster, state);
            subject = description.charAt(0).toUpperCase() + description.slice(1);
        }
        if (subject) {
            const dx = monster.mx - state.u.ux, dy = monster.my - state.u.uy;
            const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? ' next to you'
                : dx * dx + dy * dy <= BOLT_LIM * BOLT_LIM ? ' close by' : '';
            await plineWithContinuation(`${subject}${exclaim ? ' suddenly' : ''} ${verbForSubject(subject, 'appear')}${near}${exclaim ? '!' : '.'}`, {
                noRepeat: true,
            });
        }
    }
    await interruptOccupationForBirth(monster, state);
    return monster;
}
async function disguisedBirthName(monster, state) {
    const appearance = M_AP_TYPE(monster);
    let name;
    if (appearance === M_AP_FURNITURE) {
        const symbol = monster.mappearance === undefined
            ? undefined : MAP_SYMBOLS[monster.mappearance];
        if (!symbol)
            throw new Error('mimic furniture appearance has no map symbol');
        name = withIndefiniteArticle(symbol.name);
    }
    else if (appearance === M_AP_OBJECT) {
        name = await objectAtMonsterDescription(monster, state);
    }
    else {
        name = 'something';
    }
    const region = visibleRegionAt(state, monster.mx, monster.my);
    const range = Math.max(state.u.xray_range ?? 1, 1);
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (region && distance <= range * (range + 1))
        name += `, in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`;
    return name;
}
export async function objectAtMonsterDescription(monster, state = game, { glyph = null } = {}) {
    const level = requireGameLevel(state);
    glyph ??= level.flags.hero_memory
        ? level.at(monster.mx, monster.my)?.remembered_glyph ?? null
        : glyphAt(monster.mx, monster.my, state);
    if (glyph?.kind !== 'object')
        return 'something';
    const matchingMimic = M_AP_TYPE(monster) === M_AP_OBJECT
        && monster.mappearance === glyph.otyp;
    const objectType = glyph.otyp;
    // A hallucinated glyph can match a real floor or buried object instead
    // of the mimic. Only a matching mimic overrides that real object.
    const floor = level.objects[monster.mx]?.[monster.my] || [];
    const buried = level.buriedObjects || [];
    const realObject = matchingMimic ? null
        : floor.find(object => object.otyp === objectType)
            || buried.find(object => object.otyp === objectType
                && object.ox === monster.mx && object.oy === monster.my);
    const temporary = !realObject;
    const object = realObject || (OBJECT_NAMES[glyph.otyp]
        ? await mksobj(glyph.otyp, false, false)
        : await mkobj(objectClassForType(glyph.otyp), false));
    try {
        if (temporary) {
            // object_from_map() stops no-init corpse/egg/figurine timers.
            stopObjectTimers(object, state);
            if (object.otyp === GOLD_PIECE)
                object.quan = 2;
            const represented = monster.mcorpsenm;
            const hasRepresentedSpecies = matchingMimic
                && represented !== undefined && represented >= 0;
            if (object.otyp === SLIME_MOLD) {
                const fruit = hasRepresentedSpecies ? represented : state.context.current_fruit;
                if (fruit === undefined)
                    throw new Error('mimic description requires fruit history');
                object.spe = fruit;
            }
            else if (hasRepresentedSpecies)
                object.corpsenm = represented;
        }
        const nextToHero = Math.abs(monster.mx - state.u.ux) <= 1
            && Math.abs(monster.my - state.u.uy) <= 1;
        if (nextToHero && !heroIsBlind(state) && !heroIsHallucinating(state)
            && (temporary || object.where === 'floor') && !state.iflags.terrainmode)
            observeObject(object, state);
        if (temporary && matchingMimic
            && (object.dknown || ((monster.m_ap_type ?? 0) & M_AP_F_DKNOWN))) {
            monster.m_ap_type = (monster.m_ap_type ?? 0) | M_AP_F_DKNOWN;
            observeObject(object, state);
        }
        const noun = minimalObjectName(object, state);
        return object.quan === 1 ? withIndefiniteArticle(noun) : makePlural(noun);
    }
    finally {
        if (temporary) {
            object.where = 'free';
            deallocateObject(object, state);
        }
    }
}
async function interruptOccupationForBirth(monster, state) {
    if (!state._occupation)
        return;
    if (!heroIsHallucinating(state)
        && (monster.mpeaceful || monsterHasNoAttacks(monster.mnum)))
        return;
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (distance > (BOLT_LIM + 1) ** 2 || !canSpotMonster(monster)
        || !couldsee(monster.mx, monster.my) || !monster.mcanmove
        || monsterIsScaredAt(monster, state, state.u.ux, state.u.uy))
        return;
    await stopHeroOccupation(state);
}
//# sourceMappingURL=monster_birth.js.map