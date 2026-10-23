// C wizcmds.c:wiz_makemap(), makemap_remove_mons(), makemap_unmakemon();
// cmd.c:makemap_prepost(). Pets leave before the old level is discarded.
import type { DungeonLocation } from './dungeon_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import {
    ACH_MINE_PRIZE, ACH_SOKO_PRIZE, G_EXTINCT,
    MON_ENDGAME_MIGR, MON_LIMBO, MON_MIGRATING, MON_OFFMAP,
} from './const.js';
import { heroIsPunished, placeBallAndChain, releaseCarriedBall, unplaceBallAndChain } from './ball.js';
import { cls, docrt, flush_screen, plineWithContinuation } from './display.js';
import { insideWizardTower, levelIsWizardTower, specialPrototypeAt } from './dungeon.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { clearHeroTrap } from './hero_traps.js';
import { placeHeroAtRandomArrival, resolveHeroArrivalCollision } from './level_change.js';
import { maybeResetPick } from './lock_context.js';
import { mklev } from './mklev.js';
import { killGenocidedMonsters } from './mon.js';
import { MONSTER_GENO } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { collectLevelFollowers } from './monster_followers.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { deliverMigratingMonsters } from './monster_migration.js';
import { deallocateObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { checkSpecialRoom } from './shk.js';
import { setPaidShopkeeper } from './shop_damage.js';
import { hasShopkeeperData } from './shop_types.js';
import { vision_reset } from './vision.js';

const G_UNIQ = 0x1000;

export async function wizMakeMap(): Promise<void> {
    requirePlayingGame(game);
    game.context.move = 0;
    if (!game.flags.debug) {
        await plineWithContinuation("Unavailable command 'wizmakemap'.");
        return;
    }
    const wasInsideTower = insideWizardTower(game.u.ux, game.u.uy);
    const pets = await removeOldLevelMonsters();
    if (game.program_state.gameover) return;
    await discardOldLevel();
    game._specialLevelPrototype = specialPrototypeAt(game.u.uz.dnum, game.u.uz.dlevel);
    await mklev();
    await returnToReplacementLevel(pets, wasInsideTower);
}

async function removeOldLevelMonsters(): Promise<Monster[]> {
    const pets = await collectLevelFollowers(game, true);
    // C fmon is newest first, whereas level.monsters appends births.
    for (const monster of requireGameLevel().monsters.slice().reverse()) {
        if (monster.mhp <= 0) continue;
        await unmakeMonster(monster);
        if (game.program_state.gameover) return pets;
    }
    // An away shopkeeper, priest, or guard still owns data about this level.
    // Remove it even if its destination is elsewhere in the dungeon.
    for (const monster of [...(game._migratingMonsters ?? [])].reverse()) {
        if (!belongsToCurrentLevel(monster)) continue;
        game._migratingMonsters = (game._migratingMonsters ?? [])
            .filter(candidate => candidate !== monster);
        monster.mstate = ((monster.mstate ?? 0) | MON_OFFMAP)
            & ~(MON_MIGRATING | MON_LIMBO | MON_ENDGAME_MIGR);
        requireGameLevel().monsters.push(monster);
        await unmakeMonster(monster);
        if (game.program_state.gameover) return pets;
    }
    purgeDeadMonsters(requireGameLevel());
    return pets;
}

async function unmakeMonster(monster: Monster): Promise<void> {
    requirePlayingGame(game);
    const vital = game.mvitals?.[monster.mnum];
    if (vital) {
        if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) vital.mvflags &= ~G_EXTINCT;
        if (vital.born) vital.born--;
    }
    // A parked guard may already be dead; its vault is going away too.
    if (monster.isgd) monster.isgd = 0;
    else if (monster.mhp <= 0) return;
    else if (hasShopkeeperData(monster) && sameLevel(monster.eshk.shoplevel, game.u.uz))
        setPaidShopkeeper(monster);
    await removeMonsterFromGame(monster);
}

function belongsToCurrentLevel(monster: Monster): boolean {
    requirePlayingGame(game);
    return !!(monster.isshk && sameLevel(monster.eshk?.shoplevel, game.u.uz)
        || monster.ispriest && sameLevel((monster.epri ?? monster.mextra?.epri)?.shrlevel, game.u.uz)
        || monster.isgd && sameLevel(monster._egd?.gdlevel, game.u.uz));
}

function sameLevel(first: DungeonLocation | undefined, second: DungeonLocation): boolean {
    return first?.dnum === second.dnum && first.dlevel === second.dlevel;
}

async function discardOldLevel(): Promise<void> {
    requirePlayingGame(game);
    const key = `${game.u.uz.dnum}:${game.u.uz.dlevel}`;
    game._overviewRecords?.delete(key);
    game._levelAnnotations?.delete(key);
    await revokeLevelPrize();
    if (heroIsPunished()) {
        await releaseCarriedBall(game);
        await unplaceBallAndChain();
    }
    maybeResetPick(null);
    if (sameLevel(game.context.digging?.level, game.u.uz)) delete game.context.digging;
    game._travelTarget = null;
    if (game.context.polearm) game.context.polearm.hitmonId = null;
    clearHeroTrap();
    await checkSpecialRoom({ newLevel: true });
    game.u.ustuck = null;
    game.u.uswallow = game.uswallow = 0;
    game.u.uswldtim = 0;
    game.u.uinwater = 0;
    game.u.uundetected = false;
    // savelev(FREEING) releases level-owned objects without destruction rolls
    // or uncreating their artifacts. Carried objects have already left.
    const level = game.level;
    for (const column of level.objects)
        for (const pile of column ?? [])
            for (const object of [...(pile ?? [])]) freeLevelObject(object);
    for (const object of [...(level.buriedObjects ?? [])]) freeLevelObject(object);
    game._levelCache?.delete(key);
}

function freeLevelObject(object: GameObject): void {
    for (const content of [...(object.contents ?? [])]) freeLevelObject(content);
    const { victual, tin, spbook } = game.context;
    if (victual?.piece === object) {
        victual.o_id = object.o_id;
        victual.piece = null;
    }
    if (tin?.tin === object) {
        tin.o_id = object.o_id;
        tin.tin = null;
    }
    if (spbook?.book === object) {
        spbook.o_id = object.o_id;
        spbook.book = null;
    }
    unlinkObject(object);
    deallocateObject(object);
}

async function revokeLevelPrize(): Promise<void> {
    requirePlayingGame(game);
    const prototype = specialPrototypeAt(game.u.uz.dnum, game.u.uz.dlevel);
    const achievement = prototype === 'minend' ? ACH_MINE_PRIZE
        : prototype === 'soko1' ? ACH_SOKO_PRIZE : null;
    if (achievement === null) return;
    const earned = game.u.uachieved ?? [];
    if (earned.some(entry => Math.abs(entry) === achievement)) {
        game.u.uachieved = earned.filter(entry => Math.abs(entry) !== achievement);
        await plineWithContinuation(`${achievement === ACH_MINE_PRIZE ? "Mine's-end" : 'Soko-prize'} achievement revoked.`);
    }
    const prizes = game.context.achieveo;
    if (prizes) {
        if (achievement === ACH_MINE_PRIZE) prizes.mines_prize_oid = 0;
        else prizes.soko_prize_oid = 0;
    }
}

async function returnToReplacementLevel(pets: readonly Monster[], wasInsideTower: boolean): Promise<void> {
    requirePlayingGame(game);
    vision_reset();
    game.vision_full_recalc = 1;
    await cls();
    const level = requireGameLevel();
    const up = !!game.u.uhave.amulet;
    const stayInsideTower = wasInsideTower && levelIsWizardTower();
    const region = stayInsideTower
        ? game._activeSpecialLevel?.downTeleportExclude
        : up ? level.upTeleportRegion : level.downTeleportRegion;
    await placeHeroAtRandomArrival(region, !stayInsideTower && up);
    await deliverMigratingMonsters(game, pets);
    if (game.program_state.gameover) return;
    if ((await killGenocidedMonsters()).heroDied) return;
    await resolveHeroArrivalCollision();
    game._heroTrack = [];
    if (heroIsPunished()) {
        await unplaceBallAndChain();
        await placeBallAndChain();
    }
    await docrt();
    await flush_screen(1);
    for (const message of game._activeSpecialLevel?.specialMessages ?? [])
        await plineWithContinuation(message);
    await checkSpecialRoom();
}
