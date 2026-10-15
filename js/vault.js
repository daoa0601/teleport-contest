// vault.js — Vault residence, guard arrival, and the initial interrogation.
// C ref: vault.c:invault(), find_guard_dest(), and the PM_GUARD setup slice.
import { guardDestination } from './vault_escort.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { isRoom } from './map_types.js';
import { getLine } from './query.js';
import { deleteEngravingAt } from './engrave.js';
import { bot, redrawMap, newsym, plineWithContinuation, displayMessageWindow } from './display.js';
import { ROOM, ROOMOFFSET, DOOR, D_NODOOR, VAULT, IS_WALL, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, MM_NOMSG, } from './const.js';
import { makemonAt } from './mklev.js';
import { vision_note_blocker_change } from './vision.js';
import { setWallStateAt } from './wall_topology.js';
import { LEVEL_TIMER_KIND, stopLevelTimer } from './object_timers.js';
import { findVaultGuard, } from './vault_guard.js';
import { hiddenGold } from './gold.js';
import { heroGoldAmount } from './hero_gold.js';
import { resetHeroFaint } from './hunger.js';
import { heroIsDeaf } from './senses.js';
import { heroIsBlind } from './senses.js';
import { adjustHeroAlignment } from './alignment.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay } from './command_state.js';
import { canSpotMonster, map_invisible } from './display.js';
import { MONSTER_SOUND } from './monster_data.js';
import { angerMonster } from './monster_anger.js';
import { setMonsterMalign } from './monster_alignment.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterName, monsterPossessive, monsterSubjectPronoun } from './monster_name.js';
import { monsterWieldedWeapon, wieldMonsterWeapon } from './monster_weapon.js';
import { BOULDER, GOLD_PIECE } from './object_data.js';
import { simpleObjectTypeName } from './objnam.js';
import { fractureRock } from './rock_breakage.js';
import { rn2 } from './rng.js';
import { formatSeenMessage, publishHeardMessage } from './hero_speech.js';
import { M_AP_OBJECT, M_AP_TYPE, NEED_HTH_WEAPON } from './const.js';
import { roomForRoomno, roomsAt } from './room.js';
const PM_GUARD = 272;
const VAULT_GUARD_TIME = 30;
const STRANGE_OBJECT = 0;
// C vault.c:vault_summon_gd(). The next world turn owns guard arrival.
export function summonVaultGuardSoon(state = game) {
    const level = requireGameLevel(state);
    const inVault = (state.u.urooms || []).some((roomno) => {
        const room = level.rooms[roomno - ROOMOFFSET];
        return isRoom(room) && room.rtype === VAULT;
    });
    if (inVault && !findVaultGuard(state))
        state.u.uinvault = VAULT_GUARD_TIME - 1;
}
function vaultRoomAt(x, y, level = game.level) {
    const roomno = roomsAt(level, x, y, VAULT)[0];
    return roomno === undefined ? null : roomForRoomno(level, roomno);
}
// Called from the synchronous once-per-global-turn owner.  Returning true
// means invault() has suspended before the later engraving-wear roll.
export function maintainVaultResidence(state = game) {
    requireLiveGame(state);
    const vault = vaultRoomAt(state.u?.ux, state.u?.uy, state.level);
    if (!vault) {
        if (state.u)
            state.u.uinvault = 0;
        return false;
    }
    const deaths = state.mvitals?.[PM_GUARD]?.died ?? 0;
    state.u.uinvault ??= 0;
    if (deaths < 2 || deaths < 50 && !rn2(deaths * deaths))
        state.u.uinvault = (state.u.uinvault || 0) + 1;
    if (state.u.uinvault < VAULT_GUARD_TIME ||
        state.u.uinvault % (VAULT_GUARD_TIME / 2) !== 0 ||
        findVaultGuard(state) ||
        state._vaultGuardArrivalPending)
        return false;
    state._vaultGuardArrivalPending = { vault };
    return true;
}
function guardEntryToward(destination) {
    const level = requireGameLevel();
    let x = game.u.ux;
    let y = game.u.uy;
    if (level.at(x, y)?.typ !== ROOM) {
        const offsets = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
            [1, 1],
            [-1, -1],
            [1, -1],
            [-1, 1],
        ];
        const roomNeighbor = offsets.find(([dx, dy]) => level.at(x + dx, y + dy)?.typ === ROOM);
        if (roomNeighbor) {
            x += roomNeighbor[0];
            y += roomNeighbor[1];
        }
    }
    while (level.at(x, y)?.typ === ROOM) {
        const dx = Math.sign(destination.x - x);
        const dy = Math.sign(destination.y - y);
        if (Math.abs(destination.x - x) >= Math.abs(destination.y - y))
            x += dx;
        else
            y += dy;
    }
    if (x === game.u.ux && y === game.u.uy) {
        const horizontalEntry = (x, y) => [HWALL, DOOR].includes(level.requireAt(x, y).typ);
        const verticalEntry = (x, y) => [VWALL, DOOR].includes(level.requireAt(x, y).typ);
        if (horizontalEntry(x + 1, y))
            x++;
        else if (horizontalEntry(x - 1, y))
            x--;
        else if (verticalEntry(x, y + 1))
            y++;
        else if (verticalEntry(x, y - 1))
            y--;
        else
            return null;
    }
    return { x, y };
}
async function readGuardName() {
    const prompt = heroIsDeaf(game) ? 'You are required to supply your name. -'
        : '"Hello stranger, who are you?" -';
    for (let tries = 5; tries > 0; tries--) {
        const response = await getLine(prompt, (_character, key) => key >= 32 && key !== 127);
        const name = response?.trim().replace(/\s+/g, ' ') ?? '\x1b';
        if (name)
            return name;
    }
    return '';
}
export async function continueVaultGuardArrival(state = game) {
    requireLiveGame(state);
    const pending = state._vaultGuardArrivalPending;
    if (!pending)
        return false;
    state._vaultGuardArrivalPending = null;
    const destination = await guardDestination(state);
    if (!destination)
        return false;
    const entry = guardEntryToward(destination);
    if (!entry)
        return false;
    const original = requireGameLevel(state).at(entry.x, entry.y);
    if (!original)
        return false;
    const guard = await makemonAt(PM_GUARD, entry.x, entry.y, MM_NOMSG);
    if (!guard)
        return false;
    guard.isgd = 1;
    guard.mpeaceful = 1;
    setMonsterMalign(guard, state);
    const heroLevel = state.u.uz;
    if (!heroLevel)
        throw new Error('Vault guard arrival requires the hero dungeon location.');
    const corridor = {
        gdlevel: { ...heroLevel },
        gddone: 0,
        ogx: entry.x,
        ogy: entry.y,
        gdx: destination.x,
        gdy: destination.y,
        vault: pending.vault,
        warncnt: 0,
        fcbeg: 0,
        fcend: 0,
        fakecorr: [],
        dropgoldcnt: 0,
    };
    guard._egd = corridor;
    state.u.uinvault = (state.u.uinvault ?? 0) + 1;
    await resetHeroFaint({ state });
    const boulders = requireGameLevel(state).objects[entry.x]?.[entry.y]?.filter(object => object.otyp === BOULDER) ?? [];
    for (const boulder of boulders)
        await fractureRock(boulder, entry.x, entry.y, { state });
    if (boulders.length) {
        const description = `${boulders.length === 1 ? 'a boulder' : 'boulders'} shatter.`;
        if (heroIsBlind(state))
            await publishHeardMessage(description, plineWithContinuation, state);
        else
            await plineWithContinuation(formatSeenMessage(description, state));
    }
    newsym(entry.x, entry.y);
    await redrawMap();
    await bot();
    const spotted = canSpotMonster(guard);
    await plineWithContinuation(spotted ? "Suddenly one of the Vault's guards enters!" : 'Someone else has entered the Vault.');
    if (!spotted)
        map_invisible(entry.x, entry.y);
    const deaf = heroIsDeaf(state), blind = heroIsBlind(state);
    const name = () => monsterName(guard, { state, capitalized: true, suppressIt: true });
    if (state.u.uswallow) {
        if (!deaf)
            await plineWithContinuation(`"What's going on here?"`);
        if (!spotted)
            await plineWithContinuation('The other presence vanishes.');
        await removeMonsterFromGame(guard);
        return true;
    }
    if (M_AP_TYPE(state.u) === M_AP_OBJECT || state.u.uundetected) {
        if (!deaf && M_AP_TYPE(state.u) === M_AP_OBJECT && state.u.mappearance !== GOLD_PIECE) {
            const appearance = state.u.mappearance ?? STRANGE_OBJECT;
            const disguise = appearance === STRANGE_OBJECT
                ? 'whatcha-may-callit' : simpleObjectTypeName(appearance, state);
            await plineWithContinuation(`"Hey!  Who left that ${disguise} in here?"`);
        }
        await plineWithContinuation(`Puzzled, ${monsterSubjectPronoun(guard, { state })} turns around and leaves.`);
        await removeMonsterFromGame(guard);
        return true;
    }
    if (state.u.strangled || (state.u.strangledTurns ?? 0) > 0
        || MONSTER_SOUND[state.u.umonnum ?? state.u.umonster ?? 260] === 0 || heroHasInvoluntaryDelay(state)) {
        await plineWithContinuation(deaf ? `${name()} huffs and turns to leave.`
            : `"I'll be back when you're ready to speak to me!"`);
        await removeMonsterFromGame(guard);
        return true;
    }
    state._occupation = null;
    if ((state.multi ?? 0) > 0)
        endVoluntaryMultiTurn(state);
    await displayMessageWindow();
    const response = await readGuardName();
    if (state.u.ualign?.type === 1 && !response.toLowerCase().startsWith(state.plname.toLowerCase()))
        adjustHeroAlignment(-1, state);
    if (['croesus', 'kroisos', 'creosote'].includes(response.toLowerCase())) {
        if (!(state.mvitals?.[286]?.died ?? 0)) {
            if (!deaf)
                await plineWithContinuation('"Oh, yes, of course.  Sorry to have disturbed you."');
            else if (!blind)
                await plineWithContinuation(`${name()} waves goodbye.`);
            await removeMonsterFromGame(guard);
        }
        else {
            await angerMonster(guard);
            if (!deaf)
                await plineWithContinuation(`"Back from the dead, are you?  I'll remedy that!"`);
            else if (!blind)
                await plineWithContinuation(`${name()} mouths something and looks very angry!`);
            if (!monsterWieldedWeapon(guard)) {
                guard.weaponCheck = NEED_HTH_WEAPON;
                await wieldMonsterWeapon(guard, state);
            }
        }
        return true;
    }
    await plineWithContinuation(deaf ? `${name()} doesn't ${blind ? '' : 'appear to '}recognize you.` : `"I don't know you."`);
    const gold = heroGoldAmount(state);
    const stashedGold = hiddenGold(state, true);
    if (!gold && !stashedGold) {
        await plineWithContinuation(deaf ? `${name()} stomps${blind ? '' : ' and beckons'}.` : '"Please follow me."');
    }
    else {
        if (!gold) {
            if (!deaf)
                await plineWithContinuation('"You have hidden gold."');
            else if (!blind)
                await plineWithContinuation(`${name()} glares at you${state.inventory.length ? 'r stuff' : ''}.`);
        }
        if (!deaf) {
            await plineWithContinuation('"Most likely all your gold was stolen from this vault."');
            await plineWithContinuation('"Please drop that gold and follow me."');
        }
        else if (!blind) {
            const possessive = monsterPossessive(guard, { state, noIt: true });
            await plineWithContinuation(`${name()} holds out ${possessive} palm and beckons with ${monsterPossessive(guard, { state, noIt: true })} other hand.`);
        }
        corridor.dropgoldcnt++;
    }
    if (!IS_WALL(original.typ)) {
        const { lx, hx, ly, hy } = pending.vault;
        const { x, y } = entry;
        if (x === lx - 1 && y === ly - 1)
            original.typ = TLCORNER;
        else if (x === hx + 1 && y === ly - 1)
            original.typ = TRCORNER;
        else if (x === lx - 1 && y === hy + 1)
            original.typ = BLCORNER;
        else if (x === hx + 1 && y === hy + 1)
            original.typ = BRCORNER;
        else if (y === ly - 1 || y === hy + 1)
            original.typ = HWALL;
        else if (x === lx - 1 || x === hx + 1)
            original.typ = VWALL;
        original.wall_info = 0;
        setWallStateAt(entry.x, entry.y);
    }
    corridor.fakecorr.push({
        x: entry.x,
        y: entry.y,
        typ: original.typ,
        flags: original.wall_info,
    });
    corridor.fcend = 1;
    corridor.warncnt = 1;
    stopLevelTimer(entry.x, entry.y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    original.typ = DOOR;
    original.flags = original.wall_info = original.doormask = D_NODOOR;
    vision_note_blocker_change(entry.x, entry.y);
    newsym(entry.x, entry.y);
    game.vision_full_recalc = 1;
    game.context.move = 0;
    return true;
}
export { moveVaultGuard } from './vault_escort.js';
//# sourceMappingURL=vault.js.map