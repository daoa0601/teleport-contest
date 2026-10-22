// C explode.c:explode(). Floor and monster effects precede damage to the hero.
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_STR, BURNING, BURNING_OIL, COLNO, EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, MON_EXPLODE, PHYS_EXPL_TYPE, ROWNO, TRAP_EXPLODE, Upolyd, PLNMSG_CAUGHT_IN_EXPLOSION, PLNMSG_TOWER_OF_FLAME, } from './const.js';
import { canSeeMonster, canSpotMonster, flush_screen, map_invisible, newsym, plineWithContinuation, randomDisplayMonsterName, SHIELD_STATIC, show_glyph_cell, unmap_invisible, explosionGlyph, shieldGlyph, } from './display.js';
import { impossible } from './diagnostics.js';
import { finishHeroDeath } from './end.js';
import { game, requireLiveGame } from './gstate.js';
import { burnAwayHeroSlime } from './hack.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { formatHeardMessage } from './hero_speech.js';
import { igniteItems } from './light.js';
import { applyMonsterGolemEffects } from './mon.js';
import { angerAttackedMonster, wakeMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { AD_ACID, AD_COLD, AD_DGST, AD_DISN, AD_DRST, AD_ELEC, AD_FIRE, AD_MAGM, AD_PHYS, AD_RBRE, AT_ENGL, } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_NAME, monsterIsNonliving, monsterIsVampireShifter, } from './monster_data.js';
import { finishMonsterKilled } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage, } from './monster_perception.js';
import { monsterHasAcidResistance, monsterHasColdResistance, monsterHasDisintegrationResistance, monsterHasFireResistance, monsterHasPoisonResistance, monsterHasShockResistance, monsterResistsEffect, } from './monster_resistance.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { OBJECT_DIR, POT_OIL, SCR_FIRE, WAN_DIGGING, WAN_MAGIC_MISSILE, WAN_SLEEP, } from './object_data.js';
import { applyHeroGolemEffects, returnHeroToHumanForm } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { payForShopDamage } from './shop_damage.js';
import { burnArmorByFire, burnHeroArmorByFire } from './trap.js';
import { cansee } from './vision.js';
import { applyRayFloorFeatures, destroyInventoryByElement, destroyMonsterInventoryByElement, } from './zap.js';
import { rayDamageType } from './magic_types.js';
import { requirePlayingGame } from './gstate.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
const WAND_CLASS = 11;
const SCROLL_CLASS = 9;
const RAY = 3;
const M2_DEMON = 0x100;
const resistanceLevels = new Map([[WAND_CLASS, 12], [6, 10], [2, 10], [SCROLL_CLASS, 9], [8, 6], [4, 5]]);
const damageKinds = new Map([
    [AD_MAGM, {
            name: 'magical blast', floor: 'magic', property: 'antimagic',
            defense: 'magic', resists: monsterHasMagicResistance,
        }],
    [AD_FIRE, {
            name: 'fireball', floor: 'fire', items: 'fire', property: 'fireResistance',
            defense: 'fire', resists: monsterHasFireResistance,
        }],
    [AD_COLD, {
            name: 'ball of cold', floor: 'cold', items: 'cold', property: 'coldResistance',
            defense: 'cold', resists: monsterHasColdResistance,
        }],
    [AD_DISN, {
            name: 'disintegration field', floor: 'disintegration',
            property: 'disintegrationResistance', resists: monsterHasDisintegrationResistance,
        }],
    [AD_ELEC, {
            name: 'ball of lightning', floor: 'lightning', items: 'electric',
            property: 'shockResistance', defense: 'shock', resists: monsterHasShockResistance,
        }],
    [AD_DRST, {
            name: 'poison gas cloud', floor: 'poison', property: 'poisonResistance',
            defense: 'poison', resists: monsterHasPoisonResistance,
        }],
    [AD_ACID, {
            name: 'splash of acid', floor: 'acid', property: 'acidResistance',
            resists: monsterHasAcidResistance,
        }],
    [AD_PHYS, { name: 'explosion', floor: null, resists: () => false }],
]);
// A negative type is a monster zap, except that WAND_CLASS uses -otyp.
export async function explode(x, y, type, damage, objectClass, style, { state = game, publish = plineWithContinuation, die = finishHeroDeath, killer = null, heroCaused = !state.context.mon_moving, random = rn2, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const source = await explosionSource(type, damage, objectClass, state);
    if (!source)
        return { damage, heroDied: false };
    type = source.type;
    let damageType = source.damageType;
    const creditedMonster = style < 0 ? monsterAtPosition(state.level, x, y) : null;
    const insideEngulfer = !!state.u.uswallow && type >= 0;
    const held = !state.u.uswallow ? state.u.ustuck : null;
    const grabbing = !!held && Upolyd(state.u) && heroFormSticks(state);
    const grabbed = !!held && !grabbing;
    const grabPosition = held ? { x: held.mx, y: held.my } : null;
    const youExploding = objectClass === MON_EXPLODE && type >= 0;
    const monsterExplosion = objectClass === MON_EXPLODE && !youExploding;
    const hallucinate = monsterExplosion && heroIsHallucinating(state)
        && /(?:'s|s') explosion/i.test(killer || '');
    let description = monsterExplosion ? killer || source.name : source.name;
    const cells = explosionCells(x, y, damageType, objectClass, Math.abs(style), state);
    const visible = cells.some(cell => cansee(cell.x, cell.y));
    if (visible) {
        await paintExplosion(cells, state);
    }
    else if ([MON_EXPLODE, TRAP_EXPLODE].includes(objectClass))
        description = 'explosion';
    if (!heroIsDeaf(state)) {
        const message = visible || objectClass === SCROLL_CLASS
            ? 'Boom!' : formatHeardMessage('a blast.', state);
        if (message)
            await publish(message);
    }
    let heroHurt = 0;
    let shopDamage = false;
    if (damage) {
        for (const cell of cells) {
            const heroHere = state.u.ux === cell.x && state.u.uy === cell.y;
            if (heroHere) {
                heroHurt = cell.shield & 2 ? 1 : 2;
                if (heroCaused && youExploding)
                    heroHurt = 0;
            }
            else if (insideEngulfer)
                continue;
            if (!(state.u.uswallow && heroCaused) && type !== PHYS_EXPL_TYPE) {
                const floor = await applyRayFloorFeatures(source.floor, cell.x, cell.y, state, {
                    rayNoun: source.floorNoun, heroCaused: type >= 0,
                    explodingWand: source.explodingObject, heroBurnsObjects: type > 0, publish, random,
                });
                shopDamage ||= !!floor.shopDamage;
                if (state.program_state.gameover)
                    return { damage, heroDied: true };
                const target = monsterAtPosition(state.level, cell.x, cell.y);
                if (target) {
                    const woken = await wakeMonster(target, { attacked: type >= 0 });
                    if (woken.heroDied || state.program_state.gameover)
                        return { damage, heroDied: true };
                }
            }
            const monster = occupant(cell.x, cell.y, state);
            if (!monster)
                continue;
            if (hallucinate)
                description = hallucinatedExplosion(20);
            if (state.u.uswallow && state.u.ustuck === monster)
                await engulferMessage(monster, damageType, objectClass, state, publish);
            else if (cansee(cell.x, cell.y)) {
                if (monster.m_ap_type)
                    revealMonsterAppearance(monster);
                await publish(`${monsterName(monster, { state, capitalized: true })} is caught in the ${description}!`);
            }
            const seen = canSeeMonster(monster);
            const itemDamage = await destroyMonsterInventoryByElement(monster, damageKinds.get(damageType)?.items, damage, { state, publish, random, visible: seen });
            if (damageType === AD_FIRE) {
                await burnArmorByFire(monster, state, publish, [], random, { visible: seen });
                await igniteItems(monster.minvent || monster.inventory || [], { state, publish, random, visible: seen });
            }
            if (cell.shield & 1) {
                await applyMonsterGolemEffects(monster, damageType, damage, { state, publish });
                monster.mhp -= itemDamage;
            }
            else {
                let bodyDamage = damage;
                if (monsterResistsEffect(monster, (resistanceLevels.get(objectClass) ?? state.u.ulevel), random)) {
                    if (cansee(cell.x, cell.y) || insideEngulfer)
                        await publish(`${monsterName(monster, { state, capitalized: true })} resists the ${description}!`);
                    bodyDamage = Math.trunc((damage + 1) / 2);
                }
                if (grabbed && monster === state.u.ustuck
                    && Math.abs(x - state.u.ux) <= 1 && Math.abs(y - state.u.uy) <= 1)
                    bodyDamage *= 2;
                if (damageType === AD_FIRE && monsterHasColdResistance(monster)
                    || damageType === AD_COLD && monsterHasFireResistance(monster))
                    bodyDamage *= 2;
                monster.mhp -= bodyDamage + itemDamage;
            }
            if (monster.mhp <= 0) {
                const burnsCompletely = damageType === AD_FIRE
                    && ['paper golem', 'straw golem'].includes(MONSTER_NAME[monster.mnum] ?? '');
                const death = await finishExplosionMonsterDeath(monster, {
                    state, publish, heroCaused, creditedMonster, burnsCompletely, random, damageType,
                });
                // Native monkilled receives positive AD_RBRE and still leaves remains.
                // The changed adtyp also affects later targets, unlike the floor type.
                if (!heroCaused && monster !== creditedMonster && burnsCompletely)
                    damageType = AD_RBRE;
                if (death.heroDied || state.program_state.gameover)
                    return { damage, heroDied: true };
            }
            else if (heroCaused) {
                await angerAttackedMonster(monster);
                if (state.program_state.gameover)
                    return { damage, heroDied: true };
            }
        }
    }
    if (heroHurt) {
        if (state.flags.verbose && (type < 0 || objectClass !== SCROLL_CLASS)) {
            if (hallucinate)
                description = hallucinatedExplosion();
            await publish(`You are caught in the ${description}!`);
            state._lastPlineKind = PLNMSG_CAUGHT_IN_EXPLOSION;
        }
        if (damageType === AD_FIRE)
            await burnAwayHeroSlime(state, publish);
        let heroDamage = source.heroDamage;
        if (state.u.uinvulnerable || state.u.invulnerable || (state.u.invulnerableTurns ?? 0) > 0) {
            heroDamage = 0;
            await publish('You are unharmed!');
        }
        else if ([AD_PHYS, AD_ACID].includes(damageType)
            && state.u.halfPhysicalDamage)
            heroDamage = Math.trunc((heroDamage + 1) / 2);
        if (damageType === AD_FIRE) {
            await burnHeroArmorByFire(state, publish, [], random);
            await igniteItems(state.inventory, { state, publish, random });
        }
        const items = await destroyInventoryByElement(damageKinds.get(damageType)?.items, damage, {
            state, publish, die, random,
        });
        if (items.heroDied)
            return { damage, heroDied: true };
        await applyHeroGolemEffects(damageType, heroDamage, { state, publish });
        const hpKey = Upolyd(state.u) ? 'mh' : 'uhp';
        const hpBefore = state.u[hpKey];
        if (heroHurt === 2) {
            if (grabbing && grabPosition && (grabPosition.x - x) ** 2 + (grabPosition.y - y) ** 2 <= 2)
                heroDamage *= 2;
            state.u[hpKey] -= heroDamage;
            state.context.botl = true;
        }
        const observe = heroHurt === 1 ? monstersObserveHeroResistance : monstersForgetHeroResistance;
        observe(seenResistanceForDamage(damageType), state);
        if (state.u.uhp <= 0 || Upolyd(state.u) && state.u.mh <= 0) {
            if (Upolyd(state.u)) {
                if ((await returnHeroToHumanForm(state, { publish, die })).died)
                    return { damage, heroDied: true };
            }
            else {
                const cause = explosionDeathCause(type, objectClass, description, killer, state);
                const caught = [PLNMSG_CAUGHT_IN_EXPLOSION, PLNMSG_TOWER_OF_FLAME].includes(state._lastPlineKind ?? 0);
                await publish(caught ? 'It is fatal.' : `The ${description} is fatal.`);
                if (await die({ ...cause, deathLineShown: true, deathType: damageType === AD_FIRE ? BURNING : null,
                    damage: { hpKey, hpBefore, damage: heroHurt === 2 ? heroDamage : 0 },
                }))
                    return { damage, heroDied: true };
            }
        }
        await exerciseAttribute(A_STR, false, state);
    }
    if (shopDamage)
        await payForShopDamage(damageType === AD_FIRE ? 'burn away'
            : damageType === AD_COLD ? 'shatter' : damageType === AD_DISN ? 'disintegrate' : 'destroy', { state });
    if (state.program_state.gameover)
        return { damage, heroDied: true };
    const noise = Math.max(50, damage * damage);
    await wakeMonstersNearWithMessages(x, y, insideEngulfer ? Math.trunc((noise + 3) / 4) : noise, state, publish);
    return { damage, heroDied: false };
}
async function explosionSource(type, damage, objectClass, state) {
    let explodingObject = 0;
    let heroDamage = damage;
    if (objectClass === WAND_CLASS) {
        if (type < 0) {
            explodingObject = -type;
            type = OBJECT_DIR[explodingObject] === RAY && ![WAN_DIGGING, WAN_SLEEP].includes(explodingObject)
                ? explodingObject - WAN_MAGIC_MISSILE : 0;
            if (type < 0 || type > 9) {
                await impossible(`explode: wand has bad zap type (${type}).`);
                type = 0;
            }
        }
        const role = state.urole.key;
        if (['priest', 'monk', 'wizard'].includes(role))
            heroDamage = Math.trunc(damage / 5);
        else if (['healer', 'knight'].includes(role))
            heroDamage = Math.trunc(damage / 2);
    }
    else if (objectClass === BURNING_OIL)
        explodingObject = POT_OIL;
    else if (objectClass === SCROLL_CLASS)
        explodingObject = SCR_FIRE;
    else if (objectClass === TRAP_EXPLODE)
        type = 0;
    const damageType = type === PHYS_EXPL_TYPE ? AD_PHYS : rayDamageType(type);
    const kind = damageKinds.get(damageType);
    if (!kind) {
        await impossible(`explosion base type ${type}?`);
        return null;
    }
    const name = damageType === AD_FIRE && objectClass === BURNING_OIL ? 'burning oil'
        : damageType === AD_FIRE && objectClass === SCROLL_CLASS ? 'tower of flame'
            : damageType === AD_DISN && objectClass === WAND_CLASS ? 'death field' : kind.name;
    const floor = damageType === AD_DISN && Math.abs(type) !== 24 ? 'death' : kind.floor;
    const floorNoun = explodingObject || Math.abs(type) >= 20 ? 'blast' : Math.abs(type) >= 10 ? 'spell' : 'bolt';
    return { type, damageType, heroDamage, name, floor, floorNoun, explodingObject };
}
function occupant(x, y, state) {
    return monsterAtPosition(state.level, x, y)
        || (state.u.ux === x && state.u.uy === y ? state.u.usteed ?? null : null);
}
function ignoresDeathField(mnum) {
    return monsterIsNonliving(mnum) || !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_DEMON);
}
function heroResists(damageType, objectClass, state) {
    if (damageType === AD_DISN && objectClass === WAND_CLASS)
        return ignoresDeathField(heroSpecies(state));
    const kind = damageKinds.get(damageType);
    if (!kind)
        throw new Error(`Unknown explosion damage type ${damageType}`);
    return !!kind.property && (state.u[kind.property] || propertyIsActive(kind.property, state))
        || !!kind.defense && heroHasArtifactDefense(kind.defense, state);
}
function monsterResists(monster, damageType, objectClass) {
    if (damageType === AD_DISN && objectClass === WAND_CLASS)
        return ignoresDeathField(monster.mnum) || monsterIsVampireShifter(monster);
    const kind = damageKinds.get(damageType);
    if (!kind)
        throw new Error(`Unknown explosion damage type ${damageType}`);
    return kind.resists(monster);
}
function explosionCells(x, y, damageType, objectClass, style, state) {
    const cells = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const cx = x + dx, cy = y + dy;
            if (cx < 1 || cx >= COLNO || cy < 0 || cy >= ROWNO)
                continue;
            let shield = 0;
            if (state.u.ux === cx && state.u.uy === cy && heroResists(damageType, objectClass, state))
                shield |= 2;
            const monster = occupant(cx, cy, state);
            const living = monster && monster.mhp > 0;
            if (living && monsterResists(monster, damageType, objectClass))
                shield |= 1;
            if (living && cansee(cx, cy) && !canSpotMonster(monster))
                map_invisible(cx, cy);
            else if (!living)
                unmap_invisible(cx, cy);
            const glyph = explosionGlyph(style, dx, dy);
            cells.push({ x: cx, y: cy, shield, glyph });
        }
    }
    return cells;
}
async function paintExplosion(cells, state) {
    const paint = (cell) => show_glyph_cell(cell.x, cell.y, cell.glyph.ch, cell.glyph.color, cell.glyph.decgfx, 0, cell.glyph);
    const flush = async () => {
        await flush_screen(1);
        state.nhDisplay?.setCursor(state.u.ux - 1, state.u.uy + 1);
    };
    const first = cells[0];
    if (!first)
        return;
    const effect = new TemporaryMapEffect('beam', first.glyph);
    await effect.start();
    try {
        for (const cell of cells) {
            effect.changeGlyph(cell.glyph);
            await effect.show(cell.x, cell.y);
        }
        await flush();
        if (state.flags.sparkle !== false && cells.some(cell => cell.shield)) {
            for (const ch of SHIELD_STATIC) {
                const glyph = shieldGlyph(ch);
                for (const cell of cells) {
                    if (cell.shield)
                        show_glyph_cell(cell.x, cell.y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
                }
                await flush();
                await state.animationFrame?.();
            }
            for (const cell of cells)
                if (cell.shield)
                    paint(cell);
        }
        else {
            await state.animationFrame?.();
            await state.animationFrame?.();
        }
    }
    finally {
        effect.clear();
    }
}
function hallucinatedExplosion(limit = Infinity) {
    let name;
    let tries = 0;
    do {
        name = `${possessiveName(randomDisplayMonsterName())} explosion`;
    } while (name.charAt(0) !== name.charAt(0).toLowerCase() && ++tries < limit);
    return name;
}
async function engulferMessage(monster, damageType, objectClass, state, publish) {
    const digesting = (MONSTER_ATTACKS[monster.mnum] || [])
        .some(([method, damage]) => method === AT_ENGL && damage === AD_DGST);
    const effects = new Map([
        [AD_FIRE, ['heartburn', 'toasted']],
        [AD_COLD, ['chilly', 'chilly']],
        [AD_DISN, objectClass === WAND_CLASS
                ? ['irradiated by pure energy', 'overwhelmed by pure energy']
                : ['perforated', 'perforated']],
        [AD_ELEC, ['shocked', 'shocked']],
        [AD_DRST, ['poisoned', 'intoxicated']],
        [AD_ACID, ['an upset stomach', 'burned']],
    ]);
    const effect = effects.get(damageType)?.[digesting ? 0 : 1] || 'fried';
    await publish(`${monsterName(monster, { state, capitalized: true })} gets ${digesting ? '' : 'slightly '}${effect}!`);
}
async function finishExplosionMonsterDeath(monster, { state, publish, heroCaused, creditedMonster, burnsCompletely, random, damageType, }) {
    if (heroCaused)
        return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, { noCorpse: burnsCompletely, publish });
    if (monster === creditedMonster) {
        if (cansee(monster.mx, monster.my) || canSpotMonster(monster)) {
            const fate = burnsCompletely ? 'burned completely' : monsterIsNonliving(monster.mnum) ? 'destroyed' : 'killed';
            await publish(`${monsterName(monster, { state, capitalized: true })} is ${fate}!`);
        }
        return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
            noCorpse: burnsCompletely, publish, showKillMessage: false, recordConduct: false,
        });
    }
    return finishMonsterKilled(monster, state, {
        publish, random, damageType: burnsCompletely ? AD_RBRE : damageType,
    });
}
function explosionDeathCause(type, objectClass, description, killer, state) {
    if (objectClass === MON_EXPLODE)
        return { killer: killer || description };
    const himself = state.flags.female ? 'herself' : 'himself';
    if (objectClass === TRAP_EXPLODE) {
        const cause = `caught ${himself} in a ${description}`;
        return { killer: cause, deathCause: cause };
    }
    if (type >= 0 && objectClass !== SCROLL_CLASS) {
        const cause = `caught ${himself} in ${state.flags.female ? 'her' : 'his'} own ${description}`;
        return { killer: cause, deathCause: cause };
    }
    return { killer: description, deathCause: ['tower of flame', 'fireball'].includes(description)
            ? `killed by a ${description}` : `killed by ${description}` };
}
export function createElementalMonsterExplosion(x, y, damageType, damage, killer, options = {}) {
    const style = damageType === AD_COLD ? EXPL_FROSTY : damageType === AD_ELEC ? EXPL_MAGICAL : EXPL_FIERY;
    return explode(x, y, -(damageType - 1 + 20), damage, MON_EXPLODE, style, {
        ...options, killer, heroCaused: false,
    });
}
//# sourceMappingURL=explosion.js.map