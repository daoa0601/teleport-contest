// The kick command and its damage helpers.
// C refs: dokick.c dokick()/kick_monster()/kickdmg()/kick_ouch()/kick_dumb().
import { A_CON, A_DEX, A_STR, A_WIS, ALTAR, DBWALL, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DOOR, FOUNTAIN, GRAVE, IRONBARS, IS_DRAWBRIDGE, IS_OBSTRUCTED, IS_STWALL, IS_TREE, LADDER, LAVAWALL, M_AP_MONSTER, M_AP_TYPE, ROOM, SDOOR, SINK, STAIRS, THRONE, isok, Is_airlevel, Is_waterlevel, } from './const.js';
import { rnd, rn2 } from './rng.js';
import { canSpotMonster, displayLiquidName, feel_location, feel_newsym, glyphAt, map_invisible, newsym, show_glyph_cell, unmap_invisible, } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { currentAttribute, currentStrength, exerciseAttribute } from './attrib.js';
import { findDrawbridgeAt } from './dbridge.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { woundHeroLegs } from './hero_legs.js';
import { loseHeroHp } from './hero_damage.js';
import { hurtleHero, kickRecoilRange } from './hero_hurtle.js';
import { finishTeleportArrival } from './location_effects.js';
import { gotoLevel } from './level_change.js';
import { askTeleportDestination } from './teleport.js';
import { finishHeroMonsterKill, finishHurtleMonsterDeath } from './hero_monster_death.js';
import { applyHeroContactPassive } from './monster_passive.js';
import { AT_KICK } from './monster_attack_types.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { checkHeroAttackOverexertion } from './hero_overexertion.js';
import { deleteEngravingAt, wipeHeroEngraving } from './engrave.js';
import { angerAttackedMonster } from './monster_anger.js';
import { abuseKickedPet, levitatingKickMisses, prepareKick, prepareKickDamage, rollKickDamage, tryKickEvasion, tryKickReel, } from './monster_kick.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterName } from './monster_name.js';
import { kickWithMonsterForm } from './hero_form_kick.js';
import { heroHasMartialKick } from './kick_rules.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { useHeroSkill } from './skills.js';
import { admitHeroKick, kickCanReachTarget } from './kick_admission.js';
import { promptDirection } from './tty_prompts.js';
import { commandResultCancelled } from './command_state.js';
import { monsterAtPosition } from './monster_location.js';
import { game, requireGameLevel } from './gstate.js';
import { isPoolAt } from './terrain_properties.js';
import { captureThrownObjectFlight } from './thrown_object.js';
import { killerObjectName } from './objnam.js';
import { disturbGrave } from './grave.js';
import { adjustHeroAlignment } from './alignment.js';
import { mksobj } from './mkobj.js';
import { placeCreatedObject } from './floor_object.js';
import { vision_recalc, vision_reset } from './vision.js';
import { BOULDER, KICKING_BOOTS, ROCK } from './object_data.js';
import { convertSecretDoor } from './detect.js';
import { kickDoor } from './kick_door.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { kickNonDoorTerrain } from './kick_terrain.js';
import { kickFloorObject } from './object_kick.js';
// C dokick.c:kick_ouch().
async function kickOuch(x, y, objectName = '') {
    await plineWithContinuation('Ouch!  That hurts!');
    await exerciseAttribute(A_DEX, false);
    await exerciseAttribute(A_STR, false);
    if (isok(x, y)) {
        if (heroIsBlind(game))
            await feel_location(x, y);
        const location = game.level?.at(x, y);
        const bridge = location && (location.typ === DOOR || location.typ === DBWALL)
            ? findDrawbridgeAt(x, y) : null;
        if (bridge) {
            await plineWithContinuation('The drawbridge is unaffected.');
            x = bridge.x;
            y = bridge.y;
        }
        await wakeMonstersNearWithMessages(x, y, 25);
    }
    if (rn2(3) === 0) {
        await woundHeroLegs('right', 5 + rnd(5));
    }
    let damage = rnd(currentAttribute(A_CON) > 15 ? 3 : 5);
    if (game.u?.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    const died = await damageHeroFromKick(damage, x, y, objectName);
    if (!died && kickCausesRecoil())
        await recoilFromKick(4 + rn2(2));
}
function kickCausesRecoil() {
    return Is_airlevel(game.u?.uz) || game.u?.levitating
        || game.u?.levitation || game.levitating;
}
// C dokick.c:kickstr().
function kickDeathReason(x, y) {
    if (!isok(x, y))
        return 'kicking nothing';
    const location = game.level?.at?.(x, y);
    if (!location)
        return 'kicking nothing';
    if (location.typ === DOOR)
        return 'kicking a door';
    if (IS_TREE(location.typ))
        return 'kicking a tree';
    if (IS_STWALL(location.typ))
        return 'kicking a wall';
    if (IS_OBSTRUCTED(location.typ))
        return 'kicking a rock';
    if (location.typ === THRONE)
        return 'kicking a throne';
    if (location.typ === FOUNTAIN)
        return 'kicking a fountain';
    if (location.typ === GRAVE)
        return 'kicking a headstone';
    if (location.typ === SINK)
        return 'kicking a sink';
    if (location.typ === ALTAR)
        return 'kicking an altar';
    if (IS_DRAWBRIDGE(location.typ))
        return 'kicking a drawbridge';
    if (location.typ === STAIRS)
        return 'kicking the stairs';
    if (location.typ === LADDER)
        return 'kicking a ladder';
    if (location.typ === IRONBARS)
        return 'kicking an iron bar';
    return 'kicking something weird';
}
async function damageHeroFromKick(amount, x, y, objectName) {
    const killer = objectName ? `kicking ${objectName}` : kickDeathReason(x, y);
    return loseHeroHp(amount, killer, { deathCause: `killed by ${killer}` });
}
async function recoilFromKick(range) {
    const { dx, dy } = game.u;
    if (dx === undefined || dy === undefined)
        throw new Error('Kick recoil requires an attempted direction.');
    return hurtleHero(-dx, -dy, range, {
        verbose: true,
        finishTeleport: finishTeleportArrival,
        gotoLevel,
        chooseTeleportDestination: askTeleportDestination,
        finishMonsterDeath: finishHurtleMonsterDeath,
    });
}
function applyKickPassive(monster, hit) {
    return applyHeroContactPassive(monster, {
        hit,
        defenderSurvived: monster.mhp > 0,
        attackType: AT_KICK,
        weapon: game.uarmf || game.u?.uarmf || null,
    });
}
// C refs: dokick.c:maybe_kick_monster(), kick_monster(), kickdmg().
// Form-specific attacks share the command admission rules. Projection affects only the
// target noun: dokick() still targets m_at(x,y) when the actor is invisible.
async function kickLiveMonster(monster, x, y) {
    const forcefight = game.context.forcefight;
    try {
        if (!monster.mpeaceful || !canSpotMonster(monster))
            game.context.forcefight = true;
        const permission = await prepareAppliedWeaponAttack(monster, null, { struckAt: { x, y } });
        if (!permission.proceed) {
            game.context.move = permission.spentTime ? 1 : 0;
            return false;
        }
        if (await checkHeroAttackOverexertion()) {
            game.context.move = 1;
            return false;
        }
    }
    finally {
        if (forcefight === undefined)
            delete game.context.forcefight;
        else
            game.context.forcefight = forcefight;
    }
    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20);
    wipeHeroEngraving(2);
    await angerAttackedMonster(monster);
    if (await levitatingKickMisses(monster)) {
        await pline('Floating in the air, you miss wildly!');
        await exerciseAttribute(A_DEX, false);
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return true;
    }
    if (monster.mundetected
        || (M_AP_TYPE(monster) && M_AP_TYPE(monster) !== M_AP_MONSTER)) {
        monster.mundetected = 0;
        await revealMonsterAppearance(monster);
        if (canSpotMonster(monster)) {
            await newsym(x, y);
            const name = monsterName(monster, { article: 'a' });
            await plineWithContinuation(`There is ${name} here.`);
        }
        else {
            await map_invisible(x, y);
            await plineWithContinuation('There is something hidden here.');
        }
    }
    if (await kickWithMonsterForm(monster, x, y)) {
        game.context.move = 1;
        return true;
    }
    const martial = heroHasMartialKick();
    const kick = await prepareKick({
        martial,
        announce: pline,
    });
    if (kick.stopped) {
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return true;
    }
    await plineWithContinuation(`You kick ${monsterName(monster)}.`);
    const evaded = await tryKickEvasion(monster, {
        clumsy: kick.clumsy,
        martial,
        announce: plineWithContinuation,
        nameMonster: actor => monsterName(actor, { capitalized: true }),
    });
    if (evaded) {
        await applyKickPassive(monster, false);
        if (monster.mx === x && monster.my === y
            && !canSpotMonster(monster))
            await map_invisible(x, y);
        game.context.move = 1;
        return true;
    }
    const preparedDamage = prepareKickDamage(monster, {
        clumsy: kick.clumsy,
    });
    if (preparedDamage.passesThroughShade) {
        await plineWithContinuation('The kick passes harmlessly through.');
        game.context.move = 1;
        return true;
    }
    await revealMonsterAppearance(monster);
    await applyCaitiffPenalty(monster);
    const petReaction = await abuseKickedPet(monster, preparedDamage.potentialDamage);
    if (petReaction.heroDied)
        return true;
    const damage = await rollKickDamage(preparedDamage, { martial });
    if (damage.damage > 0)
        monster.mhp -= damage.damage;
    const reel = await tryKickReel(monster, x - (game.u?.ux ?? x), y - (game.u?.uy ?? y), {
        martial,
        announce: plineWithContinuation,
        nameMonster: actor => monsterName(actor, { capitalized: true }),
    });
    if (reel?.heroDied)
        return true;
    const passive = await applyKickPassive(monster, true);
    if (passive.heroDied) {
        game.context.move = 1;
        return true;
    }
    if ((monster.mhp ?? 1) <= 0 && !reel?.dead) {
        await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            hallucinating: heroIsHallucinating(game),
        });
    }
    else if (monster.mx === x && monster.my === y
        && !canSpotMonster(monster)) {
        await map_invisible(x, y);
    }
    if (damage.trainSkill)
        await useHeroSkill(35);
    game.context.move = 1;
    return true;
}
// C dokick.c:dokick().
export async function dokick() {
    if (!await admitHeroKick())
        return;
    const direction = await promptDirection();
    if (!direction || (!direction.dx && !direction.dy)) {
        commandResultCancelled(); // dokick() returns ECMD_CANCEL.
        return;
    }
    game.u.dx = direction.dx;
    game.u.dy = direction.dy;
    const x = game.u.ux + game.u.dx;
    const y = game.u.uy + game.u.dy;
    // C dokick() records gk.kickedloc for every valid directed kick before
    // dispatching the target.  Peaceful monsters and pets consult it during
    // this same elapsed turn so they do not step into the square just kicked.
    game._kickedLoc = { x, y };
    if (!await kickCanReachTarget())
        return;
    const average = game.uarmf?.otyp === KICKING_BOOTS ? 99
        : Math.trunc((currentStrength()
            + currentAttribute(A_DEX) + currentAttribute(A_CON)) / 3);
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (monster) {
        const cell = game.level?.at(x, y);
        const oldGlyph = cell ? { ch: cell.disp_ch, color: cell.disp_color,
            decgfx: cell.disp_decgfx, attr: cell.disp_attr, metadata: glyphAt(x, y) } : null;
        const recoilRange = kickRecoilRange(monster.mnum);
        if (!await kickLiveMonster(monster, x, y))
            return;
        const glyph = glyphAt(x, y);
        if (monster.dead || monster.mhp <= 0) {
            if (oldGlyph && glyph?.kind === 'invisible' && oldGlyph.metadata?.kind !== 'invisible')
                await show_glyph_cell(x, y, oldGlyph.ch, oldGlyph.color, oldGlyph.decgfx, oldGlyph.attr, oldGlyph.metadata);
        }
        else if (!canSpotMonster(monster) && monster.mx === x && monster.my === y
            && glyph?.kind !== 'invisible' && !(game.u.uswallow && game.u.ustuck === monster))
            await map_invisible(x, y);
        if (!game.program_state.gameover && kickCausesRecoil() && game.context.move)
            await recoilFromKick(recoilRange);
        return;
    }
    const location = game.level?.at(x, y);
    // dokick() wakes the broad hero-level neighborhood before it dispatches
    // the concrete terrain owner.  kick_ouch() then performs the smaller
    // impact-centered wake after its attribute exercise draws.
    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20);
    wipeHeroEngraving(2);
    if (!isok(x, y)) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    await unmap_invisible(x, y);
    if ((isPoolAt(x, y) || location?.typ === LAVAWALL) !== !!game.u.uinwater) {
        await plineWithContinuation(`You splash some ${displayLiquidName(isPoolAt(x, y) ? 'water' : 'lava')} around.`);
        game.context.move = 1;
        return;
    }
    const kickedObject = game.level?.objects?.[x]?.[y]?.[0];
    const hasBoulder = game.level?.objects?.[x]?.[y]?.some(object => object.otyp === BOULDER);
    if (kickedObject && (!game.u.levitating || Is_airlevel(game.u.uz)
        || Is_waterlevel(game.u.uz) || hasBoulder)) {
        const kicked = await kickFloorObject(x, y, {
            state: game,
            dx: game.u.dx,
            dy: game.u.dy,
            publish: plineWithContinuation,
            captureFlight: captureThrownObjectFlight,
        });
        if (game.program_state.gameover)
            return;
        if (!kicked)
            await kickOuch(x, y, killerObjectName(kickedObject));
        else if (Is_airlevel(game.u.uz))
            await recoilFromKick(1);
        game.context.move = 1;
        return;
    }
    if (!location || (IS_STWALL(location.typ) && !IS_TREE(location.typ))) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    if (location.typ === GRAVE) {
        if (game.u.levitating || game.u.levitation || game.levitating) {
            await kickDumb(x, y);
        }
        else if (rn2(4) !== 0) {
            await kickOuch(x, y);
        }
        else if (!location.disturbed && rn2(2) === 0) {
            await disturbGrave(x, y);
        }
        else {
            await exerciseAttribute(A_WIS, false);
            const alignment = game.u.ualign;
            if (!alignment)
                throw new Error('Breaking a grave requires hero alignment.');
            if (game.urole?.key === 'archeologist' || game.urole?.key === 'samurai'
                || (alignment.type === 1 && alignment.record > -10))
                adjustHeroAlignment(-Math.sign(alignment.type));
            location.typ = ROOM;
            location.emptygrave = 0;
            location.disturbed = 0;
            placeCreatedObject(await mksobj(ROCK, true, false), x, y);
            deleteEngravingAt(x, y);
            if (heroIsBlind(game))
                await pline('Crack!  Something broke!');
            else {
                await pline('The headstone topples over and breaks!');
                await newsym(x, y);
            }
        }
        game.context.move = 1;
        return;
    }
    if (location.typ === DOOR) {
        await kickDoor(x, y, average, { ouch: kickOuch, dumb: kickDumb });
        return;
    }
    if (location.typ === SDOOR) {
        if (!game.u.levitating && rn2(30) < average) {
            convertSecretDoor(location);
            const uncover = (location.doormask & (D_LOCKED | D_TRAPPED)) === D_LOCKED;
            await pline(`Crash!  ${uncover ? 'Your kick uncovers' : 'You kick open'} a secret door!`);
            await exerciseAttribute(A_DEX, true);
            if (location.doormask & D_TRAPPED) {
                location.doormask = D_NODOOR;
                if (await triggerBoobyTrap('door', { bodypart: true }))
                    return;
            }
            else if (location.doormask !== D_NODOOR && !(location.doormask & D_LOCKED)) {
                location.doormask = D_ISOPEN;
            }
            await feel_newsym(x, y);
            vision_reset();
            await vision_recalc(0);
        }
        else {
            await kickOuch(x, y);
        }
        game.context.move = 1;
        return;
    }
    if (await kickNonDoorTerrain(x, y, average, { ouch: kickOuch, dumb: kickDumb }))
        return;
    await kickDumb(x, y);
    game.context.move = 1;
}
// C dokick.c:kick_dumb().
async function kickDumb(x, y) {
    // dokick.c:kick_dumb() always abuses Dexterity before deciding whether
    // an unremarkable floor kick is merely empty or strains a muscle.
    await exerciseAttribute(A_DEX, false);
    const martial = heroHasMartialKick();
    if (martial || currentAttribute(A_DEX) >= 16 || rn2(3) !== 0) {
        await pline('You kick at empty space.');
        if (heroIsBlind(game))
            await feel_location(x, y);
    }
    else {
        await pline('Dumb move!  You strain a muscle.');
        await exerciseAttribute(A_STR, false);
        await woundHeroLegs('right', 5 + rnd(5));
    }
    if (kickCausesRecoil() && rn2(2) !== 0)
        await recoilFromKick(1);
}
//# sourceMappingURL=dokick.js.map