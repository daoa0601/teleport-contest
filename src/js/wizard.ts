// C wizard.c: Amulet effects and Wizard harassment.
import { game } from './gstate.js';
import { artifactById } from './artifact.js';
import { displayColorName, monsterName } from './do_name.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { ShopGameState } from './shop_types.js';
import type { Monster } from './monster_types.js';
import { newsym } from './display.js';
import { formatFeltMessage, plineWithContinuation } from './pline.js';
import { makemonNear } from './mklev.js';
import { stairway_find_type_dir } from './stairs.js';
import { makemon, setMonsterMalign, unmakeNastySubstitute } from './makemon.js';
import { monsterAlignmentType, priestIsInOwnTemple } from './priest.js';
import { BOLT_LIM, In_endgame, Is_astralevel, Is_rogue_level, MAGIC_PORTAL, M_AP_MONSTER, MM_NOMSG, MM_NOWAIT, RLOC_MSG, STRAT_APPEARMSG, STRAT_GROUND, STRAT_HEAL, STRAT_MONSTR, STRAT_PLAYER, STRAT_WAITFORU, STRAT_WAITMASK } from './const.js';
import { isok } from './cmd.js';
import { msummon } from './minion.js';
import { rndcurse } from './throne.js';
import { dungeonBuildsUp, insideWizardTower } from './dungeon.js';
import { monsterIsHelpless, is_minion } from './mondata.js';
import { mksobj, linkObjectToMonsterInventory, remove_object } from './mkobj.js';
import { addObjectToMonsterInventory } from './steal.js';
import { recordRandom } from './monster_action_types.js';
import { MONSTER_ALIGNMENT, MONSTER_ATTACKS, MONSTER_DIFFICULTY, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL, monsterClassSymbol } from './monster_data.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import {
    catchUpMonster, monsterArrive, WIZ_ARRIVE,
} from './dog.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD, FAKE_AMULET_OF_YENDOR } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { definiteObjectAction, observeDistantObjectForNaming, objectDescription } from './objnam.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { monsterAtPosition } from './steed.js';
import { questMonsterFlags3 } from './role_monsters.js';
import { healMonster, monsterIndexByName, speciesWasGenocided, mnearto, wakeMonstersNearWithMessages } from './mon.js';
import { enexto, randomMonsterRelocation, relocateMonsterTo, monsterTeleportRestricted } from './teleport.js';
import { comPager } from './questpgr.js';
import { shopkeeperInOwnShop } from './shk.js';
import { cansee } from './vision.js';
import type { GameObject } from './object_types.js';
import type { Position, Stairway } from './map_types.js';
import { expelHero } from './mhitu.js';

const WIZARD = 285;

// C wizard.c:amulet(). Called once per global turn while carrying the Amulet.
export async function amuletTurn(state: PlayingGameState): Promise<void> {
    const amulet = state.uamul?.otyp === AMULET_OF_YENDOR ? state.uamul
        : state.uwep?.otyp === AMULET_OF_YENDOR ? state.uwep : null;
    if (amulet && !rn2(15)) {
        const portal = [...state.level.traps].reverse().find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal) {
            const dx = portal.tx - state.u.ux, dy = portal.ty - state.u.uy;
            const distance = dx * dx + dy * dy;
            const warmth = distance <= 9 ? 'hot!' : distance <= 64 ? 'very warm.'
                : distance <= 144 ? 'warm.' : null;
            if (warmth) {
                await plineWithContinuation(`${definiteObjectAction(amulet, 'feel', state)} ${warmth}`);
            }
        }
    }
    if (!state.context.no_of_wizards) return;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !monster.iswiz || !monster.msleeping || rn2(40)) continue;
        monster.msleeping = 0;
        if (Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) > 1)
            await plineWithContinuation('You get the creepy feeling that somebody noticed your taking the Amulet.');
        return;
    }
}

// C wizard.c:intervene(). Paging suspends the whole intervention before
// its caller restarts the countdown and continues environmental maintenance.
export async function intervene(): Promise<void> {
    const which = Is_astralevel(game.u.uz) ? rnd(4) : rn2(6);
    switch (which) {
    case 0:
    case 1:
        await plineWithContinuation(formatFeltMessage('vaguely nervous.'));
        break;
    case 2:
        if (!heroIsBlind(game))
            await plineWithContinuation(`You notice a ${displayColorName('black', game)} glow surrounding you.`);
        await rndcurse();
        break;
    case 3:
        game._lastDemigodAggravation = aggravateMonsters(game, rn2)
            .map(monster => monster.m_id);
        break;
    case 4: {
        let effect = await summonNastyMonsters(null);
        if (effect.deferredDemonSummon) effect = await msummon();
        game._lastDemigodNasty = effect.created.map(monster => monster.m_id);
        break;
    }
    case 5:
        await resurrectWizard();
        break;
    }
}

// C wizard.c:wizdeadorgone()
// Removal counts even when the Wizard leaves alive. The first removal starts
// demigod intervention; later deaths must not restart an existing countdown.
export function wizardDeadOrGone(state: GameState = game, random = rn2): void {
    state.context.no_of_wizards = (state.context.no_of_wizards ?? 0) - 1;
    const events = state.u.uevent ??= {};
    if (!events.udemigod) {
        events.udemigod = true;
        state.u.udg_cnt = 50 + random(250);
    }
}

// Port only: local Amulet inventory predicate; hasAmulet in muse carries the native citation.
export function monsterCarriesAmulet(monster: Monster): boolean {
    // C wizard.c:mon_has_amulet() searches only the top-level inventory.
    return (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR);
}

// C wizard.c:mon_has_special() excludes objects inside carried containers.
export function monsterCarriesSpecialObject(monster: Monster, state: GameState = game): boolean {
    return (monster.minvent ?? []).some(object =>
        object.otyp === AMULET_OF_YENDOR
        || artifactById(object.oartifact, state)?.questArtifact
        || object.otyp === BELL_OF_OPENING
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === SPE_BOOK_OF_THE_DEAD);
}

// Port only: local helpless-monster predicate; monsterIsHelpless carries the native macro citation.
function monsterHelpless(monster: Monster): boolean {
    // C mon.c:helpless().
    return !monster.mcanmove || !!monster.msleeping;
}

// Part of C wizard.c:resurrect(): find, revive, and place an eligible migrating Wizard.
async function recallMigratingWizard(): Promise<Monster | null> {
    // C wizard.c:resurrect() migrating_mons scan.  Returns a placed wizard
    // or null; placement failure re-queues the monster for later attempts.
    // Migration arrays append where C prepends to migrating_mons.
    for (const candidate of [...(game._migratingMonsters ?? [])].reverse()) {
        if (!candidate.iswiz) continue;
        // if he has the Amulet, he won't bring it to you
        if (monsterCarriesAmulet(candidate)) continue;
        let elapsed = (game.moves ?? 0) - (candidate.mlstmv ?? game.moves ?? 0);
        if (!(elapsed > 0)) continue;
        await catchUpMonster(candidate, elapsed, game);
        if (elapsed >= 0x7fffffff) elapsed = 0x7fffffff - 1;
        elapsed = Math.trunc(elapsed / 50);
        if (candidate.msleeping && rn2(elapsed + 1)) candidate.msleeping = 0;
        if (candidate.mfrozen === 1) {
            // would unfreeze on next move
            candidate.mfrozen = 0;
            candidate.mcanmove = 1;
        }
        if (monsterHelpless(candidate)) continue;
        // mon_arrive() might have sent him into limbo again; only a placed
        // wizard counts as resurrected.
        return monsterArrive(candidate, WIZ_ARRIVE, game)
            .then(placed => placed ? candidate : null);
    }
    return null;
}

// C wizard.c:resurrect().
export async function resurrectWizard(): Promise<Monster | null> {
    let wizard: Monster | null = null;
    let verb = 'kill';
    if (!game.context?.no_of_wizards) {
        wizard = await makemonNear(WIZARD, game.u.ux, game.u.uy, MM_NOWAIT);
        if (wizard) {
            // he's not coming back from a corpse but is subject to repeated
            // killing like a revived corpse
            wizard.mrevived = 1;
        }
    } else {
        verb = 'elude';
        wizard = await recallMigratingWizard();
    }

    if (wizard) {
        wizard.mstrategy = (wizard.mstrategy || 0) & ~STRAT_WAITMASK;
        // paranoia
        wizard.mtame = 0;
        wizard.mpeaceful = 0;
        setMonsterMalign(wizard);
        if (!heroIsDeaf(game)) {
            await plineWithContinuation('A voice booms out...');
            await plineWithContinuation(`"So thou thought thou couldst ${verb} me, fool."`);
        }
    }
    return wizard;
}

// C wizard.c:has_aggravatables().  Only spell_would_be_useless() consults it
// while checking the aggravation spell.
export function monsterSpellHasAggravatables(caster: Monster, state: PlayingGameState) {
    const inTower = insideWizardTower(caster.mx, caster.my, state);
    if (inTower !== insideWizardTower(state.u.ux, state.u.uy, state)) return false;
    return state.level.monsters.some(
        (monster) =>
            !monster.dead &&
            (monster.mhp ?? 1) > 0 &&
            insideWizardTower(monster.mx, monster.my, state) === inTower &&
            ((monster.mstrategy ?? 0) & STRAT_WAITFORU ||
                monsterIsHelpless(monster)),
    );
}

// wizard.c's wizapp table.  A clone usually masquerades as one of these
// species until it acts.
const WIZARD_CLONE_APPEARANCE_NAMES = [
    'human',
    'water demon',
    'vampire',
    'red dragon',
    'troll',
    'umber hulk',
    'xorn',
    'xan',
    'cockatrice',
    'floating eye',
    'guardian naga',
    'trapper',
];

// C wizard.c:clonewiz().  makemon() for the clone happens in the mcastu
// completion which owns the tty boundary; this finishes the cloned Wizard.
export async function finishWizardClone(clone: Monster, state: PlayingGameState,
    random: RandomBelow, calls: MonsterCallLog) {
    clone.msleeping = 0;
    clone.mtame = 0;
    clone.mpeaceful = 0;
    if (!state.u?.uhave?.amulet && recordRandom(random, calls, 2) !== 0) {
        const fake = await mksobj(FAKE_AMULET_OF_YENDOR, true, false);
        // wizard.c:clonewiz() uses add_to_minv(), not mpickobj(): a newly
        // minted fake Amulet links directly without carrying effects.
        await linkObjectToMonsterInventory(clone, fake);
    }
    const protectedFromShapechangers = !!state.u?.protectionFromShapeChangers;
    if (!protectedFromShapechangers) {
        const appearanceIndex = recordRandom(
            random,
            calls,
            WIZARD_CLONE_APPEARANCE_NAMES.length,
        );
        clone.m_ap_type = M_AP_MONSTER;
        clone.mappearance = MONSTER_NAME.indexOf(
            WIZARD_CLONE_APPEARANCE_NAMES[appearanceIndex] ?? '',
        );
    }
    await newsym(clone.mx, clone.my);
    return clone;
}

// C wizard.c:aggravate().
export function aggravateMonsters(state: GameState = game, random = rn2): Monster[] {
    const heroInsideTower = insideWizardTower(
        state.u?.ux, state.u?.uy, state,
    );
    const awakened = [];

    // Native fmon visits the most recently created monster first.
    for (const monster of Array.from(state.level?.monsters || []).reverse()) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0) continue;
        if (insideWizardTower(monster.mx, monster.my, state)
            !== heroInsideTower) continue;

        const wasSleeping = !!monster.msleeping;
        const wasWaiting = !!((monster.mstrategy ?? 0)
            & (STRAT_WAITFORU | STRAT_APPEARMSG));
        monster.mstrategy = (monster.mstrategy ?? 0)
            & ~(STRAT_WAITFORU | STRAT_APPEARMSG);
        monster.msleeping = 0;
        let unfroze = false;
        if (!monster.mcanmove && random(5) === 0) {
            monster.mfrozen = 0;
            monster.mcanmove = 1;
            unfroze = true;
        }
        if (wasSleeping || wasWaiting || unfroze) awakened.push(monster);
    }
    return awakened;
}

// Artifact selection and pursuit for covetous monsters.
// C wizard.c:strategy(), target_on(), and tactics()'s target branches.
const WANTS_AMULET = 1;
const WANTS_BELL = 2;
const WANTS_BOOK = 4;
const WANTS_CANDELABRUM = 8;
const WANTS_ARTIFACT = 16;

type CovetousTarget =
    | { kind: 'hero'; position: Position; mask: number }
    | { kind: 'floor'; position: Position; mask: number; object: GameObject }
    | { kind: 'monster'; position: Position; mask: number };
type CovetousStrategy =
    | { kind: 'heal' }
    | { kind: 'harass' }
    | { kind: 'target'; target: CovetousTarget };

// C wizard.c:strategy(): the health threshold, the want-mask priority, and
// target_on()'s pick, then the strategy word installed on the monster.
export function chooseCovetousStrategy(monster: Monster, state: PlayingGameState): CovetousStrategy {
    let goal: Position | undefined;
    let strategy: CovetousStrategy;
    if (shopkeeperInOwnShop(monster, state) || priestIsInOwnTemple(monster, state)) {
        strategy = { kind: 'harass' };
    } else {
        const health = Math.trunc(monster.mhp * 3 / monster.mhpmax);
        if (health < 1 || health > 3
            || health === 1 && MONSTER_NAME[monster.mnum] !== 'Wizard of Yendor') {
            strategy = { kind: 'heal' };
        } else {
            const masks = state.context.made_amulet ? [WANTS_AMULET] : [];
            masks.push(...(state.u.uevent?.invoked
                ? [WANTS_ARTIFACT, WANTS_BOOK, WANTS_BELL, WANTS_CANDELABRUM]
                : [WANTS_BOOK, WANTS_BELL, WANTS_CANDELABRUM, WANTS_ARTIFACT]));
            let chosen: CovetousStrategy | null = null;
            for (const mask of masks) {
                // strategy() selects individual targets from the raw wants word.
                if (!(questMonsterFlags3(monster.mnum, state) & mask)) continue;
                const target = findCovetousTarget(monster, mask, state);
                if (target) {
                    chosen = { kind: 'target', target };
                    goal = { ...target.position };
                    break;
                }
                goal = { x: 0, y: 0 };
            }
            strategy = chosen ?? { kind: health < 3 ? 'heal' : 'harass' };
        }
    }
    if (goal) monster.mgoal = goal;
    const target = strategy.kind === 'target' ? strategy.target : null;
    const flags = strategy.kind === 'heal' ? STRAT_HEAL
        : target ? target.mask | (target.kind === 'hero' ? STRAT_PLAYER
            : target.kind === 'floor' ? STRAT_GROUND : STRAT_MONSTR) : 0;
    monster.mstrategy = ((monster.mstrategy ?? 0) & (STRAT_WAITMASK | STRAT_APPEARMSG)) | flags;
    return strategy;
}

// C wizard.c:target_on()
// Also C wizard.c:mon_has_arti(): inlined here for the seeking monster.
// Also C wizard.c:on_ground(): inlined here for floor objects.
// Also C wizard.c:other_mon_has_arti(): inlined here for other carriers.
function findCovetousTarget(monster: Monster, mask: number, state: PlayingGameState): CovetousTarget | null {
    // C wizard.c:target_on() checks the requested wants mask directly.
    if (!(questMonsterFlags3(monster.mnum, state) & mask)) return null;
    const matches = (object: GameObject) => objectMatchesTarget(object, mask, state);
    if (!(monster.minvent ?? []).some(matches)) {
        if (heroHasTarget(mask, state))
            return { kind: 'hero', position: { x: state.u.ux, y: state.u.uy }, mask };
        const floor = state.level.objects.flatMap(column =>
            (column ?? []).flatMap(pile => pile ?? []))
            .filter(matches).sort((a, b) => (b._fobjOrder ?? 0) - (a._fobjOrder ?? 0))[0];
        if (floor) return { kind: 'floor', position: { x: floor.ox, y: floor.oy }, mask, object: floor };
        // other_mon_has_arti() considers the first fmon carrier before the
        // Amulet exception; it does not search past an excluded carrier.
        const carrier = [...state.level.monsters].reverse().find(candidate =>
            candidate !== monster && (candidate.minvent ?? []).some(matches));
        if (carrier && (mask !== WANTS_AMULET || !carrier.iswiz && !priestIsInOwnTemple(carrier, state)))
            return { kind: 'monster', position: { x: carrier.mx, y: carrier.my }, mask };
    }
    return null;
}

// Part of C wizard.c:which_arti(): object-type selection is inlined into this predicate.
function objectMatchesTarget(object: GameObject, mask: number, state: PlayingGameState): boolean {
    if (mask === WANTS_AMULET) return object.otyp === AMULET_OF_YENDOR;
    if (mask === WANTS_BELL) return object.otyp === BELL_OF_OPENING;
    if (mask === WANTS_BOOK) return object.otyp === SPE_BOOK_OF_THE_DEAD;
    if (mask === WANTS_CANDELABRUM) return object.otyp === CANDELABRUM_OF_INVOCATION;
    return !!object.questArtifact || !!artifactById(object.oartifact, state)?.questArtifact;
}

// C wizard.c:you_have()
function heroHasTarget(mask: number, state: PlayingGameState): boolean {
    const owns = state.u.uhave;
    if (mask === WANTS_AMULET) return !!owns?.amulet;
    if (mask === WANTS_BELL) return !!owns?.bell;
    if (mask === WANTS_BOOK) return !!owns?.book;
    if (mask === WANTS_CANDELABRUM) return !!owns?.menorah;
    return !!owns?.questart;
}

// Part of C wizard.c:tactics(): pursue an artifact held by the hero, on the ground, or carried by a monster.
export async function pursueCovetousTarget(monster: Monster, target: CovetousTarget,
    state: PlayingGameState): Promise<'continued' | 'blocked-ground'> {
    const { x, y } = target.position;
    if (!target.mask || !isok(x, y)) return 'continued';
    const restricted = monsterTeleportRestricted(monster, state);
    if (restricted && Math.max(Math.abs(monster.mx - x), Math.abs(monster.my - y)) > 1)
        return 'continued';
    if (target.kind === 'hero' || x === state.u.ux && y === state.u.uy) {
        await approachTarget(monster, x, y, restricted, state);
        return 'continued';
    }
    if (target.kind === 'floor') {
        const occupant = monsterAtPosition(state.level, x, y);
        if (occupant && occupant !== monster)
            return 'blocked-ground';
        await relocateMonsterTo(monster, x, y, { state });
        if (cansee(monster.mx, monster.my)) {
            const subject = monsterName(monster, { state, capitalized: true });
            observeDistantObjectForNaming(target.object, state);
            const object = await objectDescription(target.object, { state });
            await plineWithContinuation(`${subject} picks up ${object}.`);
        }
        remove_object(target.object, state);
        await addObjectToMonsterInventory(monster, target.object, state, { atFront: true });
        return 'continued';
    }
    await approachTarget(monster, x, y, restricted, state);
    return 'continued';
}

// Part of C wizard.c:tactics(): attempt relocation beside the target and retain the old position on failure.
async function approachTarget(monster: Monster, x: number, y: number,
    restricted: boolean, state: PlayingGameState): Promise<void> {
    const oldx = monster.mx, oldy = monster.my;
    if (restricted || !await mnearto(monster, x, y, state, { flags: RLOC_MSG }))
        await relocateMonsterTo(monster, oldx, oldy, { state });
}

// C wizard.c:tactics(STRAT_HEAL), including choose_stairs() and the
// fall-through to harassment when the monster cannot heal at a distance.
export async function retreatCovetousMonster(
    monster: Monster, state: PlayingGameState, random = rn2, rollOne = rnd,
): Promise<'harass' | 'recovered' | 'blocked'> {
    monster.mstrategy = ((monster.mstrategy ?? 0) & (STRAT_WAITMASK | STRAT_APPEARMSG)) | STRAT_HEAL;
    let healingX = monster.mx, healingY = monster.my;
    if (state.u.uswallow && state.u.ustuck === monster) {
        const expelled = await expelHero(monster, { state, random, rollOne });
        if (expelled.died) return 'blocked';
    }
    const stairs = chooseStairs(!!(monster.m_id % 2), state);
    monster.mavenge = 1;
    const amulet = (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR);
    const staysInTower = insideWizardTower(healingX, healingY, state)
        || (monster.iswiz && !stairs && !amulet);
    if (staysInTower) {
        if (!monsterTeleportRestricted(monster, state)
            && random(3 + Math.trunc(monster.mhp / 10)) === 0)
            await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
    } else if (stairs && (healingX !== stairs.sx || healingY !== stairs.sy)) {
        if (!monsterTeleportRestricted(monster, state)
            && !await mnearto(monster, stairs.sx, stairs.sy, state, { moveOther: true, flags: RLOC_MSG })) {
            // Expulsion may have moved the monster since tactics() saved this square.
            await relocateMonsterTo(monster, healingX, healingY, { state, random, rollOne });
            return 'blocked';
        }
        healingX = monster.mx;
        healingY = monster.my;
    }
    // tactics() updates its cached position only when retreating to stairs.
    const dx = healingX - state.u.ux, dy = healingY - state.u.uy;
    if (dx * dx + dy * dy > BOLT_LIM * BOLT_LIM && monster.mhp <= monster.mhpmax - 8) {
        healMonster(monster, rollOne(8));
        return 'recovered';
    }
    return 'harass';
}

// C wizard.c:choose_stairs(): a flee spot for covetous monsters or a rally
// point for guardians (Kops). C prefers stairs, then a ladder, in the travel
// direction; then a branch stairway in any direction; then stairs or a
// ladder in the other direction. Null when only a portal reaches the level.
export function chooseStairs(dir: boolean, state: PlayingGameState | ShopGameState): Stairway | null {
    // With no stairway at all, C's stairway_find_type_dir() loop never runs;
    // skip builds_up() too, which needs an initialized dungeon list.
    if (!state.stairs) return null;
    const stdir = dungeonBuildsUp(state.u.uz, state) ? dir : !dir;
    let stway = stairway_find_type_dir(state, false, stdir)
        ?? stairway_find_type_dir(state, true, stdir);
    if (!stway) {
        // no ladder either; look for branch stairs or ladder in any direction
        for (stway = state.stairs; stway; stway = stway.next)
            if (stway.tolev.dnum !== state.u.uz.dnum) break;
        // if no branch stairs/ladder, check for regular stairs in
        // opposite direction, then for regular ladder if necessary
        if (!stway) {
            stway = stairway_find_type_dir(state, false, !stdir)
                ?? stairway_find_type_dir(state, true, !stdir);
        }
    }
    /* [note: 'stway' could still be Null if the only access to this
       level is via magic portal] */
    return stway;
}

// C wizard.c:cuss(), shared by monster turns and sounds.c:domonnoise().

const WIZARD_CUSS_INSULTS = [
    'antic', 'blackguard', 'caitiff', 'chucklehead', 'coistrel', 'craven',
    'cretin', 'cur', 'dastard', 'demon fodder', 'dimwit', 'dolt', 'fool',
    'footpad', 'imbecile', 'knave', 'maledict', 'miscreant', 'niddering',
    'poltroon', 'rattlepate', 'reprobate', 'scapegrace', 'varlet', 'villein',
    'wittol', 'worm', 'wretch',
];
const WIZARD_CUSS_MALEDICTIONS = [
    'Hell shall soon claim thy remains,',
    'I chortle at thee, thou pathetic',
    'Prepare to die, thou',
    'Resistance is useless,',
    'Surrender or die, thou',
    'There shall be no mercy, thou',
    'Thou shalt repent of thy cunning,',
    'Thou art as a flea to me,',
    'Thou art doomed,',
    'Thy fate is sealed,',
    'Verily, thou shalt be one dead',
];

// C wizard.c:cuss()
export async function publishMonsterCuss(
    monster: Monster, state: PlayingGameState, random = rn2,
): Promise<void> {
    if (heroIsDeaf(state)) return;
    const minion = is_minion(monster.mnum);
    const extension = monster.emin ?? monster.mextra?.emin;
    if (monster.iswiz) {
        await plineWithContinuation(selectWizardCussMessage(monster, state, random));
    } else if (minion && monsterAlignmentType(monster) === 1
        && !(monster.isminion && extension?.renegade)) {
        await comPager('angel_cuss', state);
    } else if (!random(minion ? 100 : 5)) {
        await plineWithContinuation(`${monsterName(monster, { capitalized: true, state })} casts aspersions on your ancestry.`);
    } else {
        await comPager('demon_cuss', state);
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 25, state);
}

// Part of C wizard.c:cuss(): choose the Wizard's threat or insult.
function selectWizardCussMessage(monster: Monster, game: PlayingGameState, roll: typeof rn2): string {
    if (roll(5) === 0)
        return monsterName(monster, { capitalized: true, state: game }) + ' laughs fiendishly.';
    if (game.u?.uhave?.amulet
        && roll(WIZARD_CUSS_INSULTS.length) === 0) {
        return '"Relinquish the amulet, '
            + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)] + '!"';
    }
    if ((game.u?.uhp ?? 1) < 5 && roll(2) === 0) {
        const line = roll(2)
            ? 'Even now thy life force ebbs, '
            : 'Savor thy breath, ';
        const suffix = line.startsWith('Savor')
            ? ', it be thy last!' : '!';
        return '"' + line
            + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)]
            + suffix + '"';
    }
    if ((monster.mhp ?? 1) < 5 && roll(2) === 0)
        return roll(2) ? '"I shall return."' : '"I\'ll be back."';
    return '"' + WIZARD_CUSS_MALEDICTIONS[
        roll(WIZARD_CUSS_MALEDICTIONS.length)
    ] + ' ' + WIZARD_CUSS_INSULTS[
        roll(WIZARD_CUSS_INSULTS.length)
    ] + '!"';
}

// ── C wizard.c:pick_nasty().
const NASTY_MONSTERS = [
    'cockatrice', 'ettin', 'stalker', 'minotaur',
    'owlbear', 'purple worm', 'xan', 'umber hulk',
    'xorn', 'zruty', 'leocrotta', 'baluchitherium',
    'carnivorous ape', 'fire elemental', 'jabberwock',
    'iron golem', 'ochre jelly', 'green slime',
    'displacer beast', 'genetic engineer',
    'black dragon', 'red dragon', 'arch-lich', 'vampire leader',
    'master mind flayer', 'disenchanter', 'winged gargoyle',
    'storm giant', 'Olog-hai', 'elf-noble', 'elven monarch',
    'ogre tyrant', 'captain', 'gremlin',
    'silver dragon', 'orange dragon', 'green dragon', 'yellow dragon',
    'guardian naga', 'fire giant', 'Aleax', 'couatl',
    'horned devil', 'barbed devil',
].map(monsterIndexByName);

const NASTY_SHAPE_DEMOTIONS: readonly (readonly [string, string])[] = [
    ['cockatrice', 'chickatrice'],
    ['purple worm', 'baby purple worm'],
    ['black dragon', 'baby black dragon'],
    ['red dragon', 'baby red dragon'],
    ['silver dragon', 'baby silver dragon'],
    ['orange dragon', 'baby orange dragon'],
    ['green dragon', 'baby green dragon'],
    ['yellow dragon', 'baby yellow dragon'],
    ['arch-lich', 'master lich'],
    ['vampire leader', 'vampire'],
    ['master mind flayer', 'mind flayer'],
    ['elf-noble', 'elf'],
    ['elven monarch', 'elf-noble'],
    ['ogre tyrant', 'ogre leader'],
    ['captain', 'lieutenant'],
];
const NASTY_BIG_TO_LITTLE = new Map(NASTY_SHAPE_DEMOTIONS.map(([large, small]): [number, number] => [
    monsterIndexByName(large), monsterIndexByName(small),
]));
// C wizard.c:pick_nasty()
export function pickNastyShape(difficultyCap: number): number {
    let result = pickNastyCandidate();
    if (Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(result))) {
        result = pickNastyCandidate();
    }

    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const outOfPlaceMask = inHell ? 0x0800 : 0x0400;
    const shouldDemote = speciesWasGenocided(result, game)
        || (difficultyCap > 0
            && (MONSTER_DIFFICULTY[result] ?? 0) >= difficultyCap)
        || !!((MONSTER_GENO[result] ?? 0) & outOfPlaceMask);
    const alternate = shouldDemote
        ? (NASTY_BIG_TO_LITTLE.get(result) ?? result) : result;
    if (alternate !== result && !speciesWasGenocided(alternate, game)) {
        const name = MONSTER_NAME[alternate] ?? '';
        if (!name.startsWith('baby ')
            && !/(?: hatchling| pup| cub)$/.test(name)) {
            result = alternate;
        }
    }
    return result;
}

const S_DEMON_WIZ = 56;
const S_ANGEL_WIZ = 27;

// Part of C minion.c:monster_census(): count all living monsters, excluding parked guards.
function nastyMonsterCensus(): number {
    return game.level?.monsters.filter(monster => !monster.dead && monster.mhp > 0
        && !(monster.isgd && monster.mx === 0)).length ?? 0;
}

// C wizard.c:nasty()
// Uses wizard.c:pick_nasty() above for mcastu.c:mcast_summon_mons().
// A monster-cast summon deliberately chooses an explicit high-difficulty
// species, asks enexto() for a square around the caster's apparent hero
// position, then runs the ordinary makemon() constructor.  The created
// actors retain the normal constructor's messages and display updates.
export async function summonNastyMonsters(
    summoner: Monster | null,
): Promise<{ count: number; created: Monster[]; deferredDemonSummon?: boolean }> {
    const created: Monster[] = [];
    const census = nastyMonsterCensus();
    const flags = summoner ? MM_NOMSG : 0;
    const inHell = !!game.dungeons?.[
        game.u?.uz?.dnum ?? 0
    ]?.flags.hellish;

    // wizard.c:nasty() occasionally delegates to demon.c:msummon().  The
    // caller handles that different summoning path.
    if (!rn2(10) && inHell) {
        return {
            count: 0,
            created,
            deferredDemonSummon: true,
        };
    }

    const summonerClass = summoner ? MONSTER_SYMBOL[summoner.mnum] ?? 0 : 0;
    let difficultyCap = summoner ? MONSTER_DIFFICULTY[summoner.mnum] ?? 0 : 0;
    const casterAlignment = Math.sign(
        summoner ? MONSTER_ALIGNMENT[summoner.mnum] ?? 0 : 0,
    );
    const outerLimit = (game.u?.ulevel ?? 1) > 3
        ? Math.trunc((game.u?.ulevel ?? 1) / 3) : 1;
    const outerCount = rnd(outerLimit);
    const archLich = MONSTER_NAME.indexOf('arch-lich');
    const archon = MONSTER_NAME.indexOf('Archon');
    const lowerArchDifficulty = Math.min(
        MONSTER_DIFFICULTY[archon] ?? 0,
        MONSTER_DIFFICULTY[archLich] ?? 0,
    );

    for (let i = outerCount; i > 0 && created.length < 10; --i) {
        for (let j = 0; j < 20; ++j) {
            let makeindex = null;
            let candidateClass = 0;
            let tryLimit = 11;
            do {
                if (!--tryLimit) {
                    makeindex = null;
                    break;
                }
                makeindex = pickNastyShape(difficultyCap);
                candidateClass = MONSTER_SYMBOL[makeindex] ?? 0;
            } while (
                (difficultyCap > 0
                    && (MONSTER_DIFFICULTY[makeindex] ?? 0)
                        >= difficultyCap
                    && (MONSTER_ATTACKS[makeindex] || []).some(
                        ([attackType]) => attackType === 255,
                    ))
                || (summonerClass === S_DEMON_WIZ && candidateClass === S_ANGEL_WIZ)
                || (summonerClass === S_ANGEL_WIZ && candidateClass === S_DEMON_WIZ)
            );
            if (makeindex == null) continue;

            const position = summoner ? enexto(makeindex,
                summoner.mux ?? game.u.ux, summoner.muy ?? game.u.uy)
                : { x: game.u.ux, y: game.u.uy };
            if (!position) continue;
            let monster = await makemon(makeindex, position.x, position.y, flags);
            if (monster) {
                monster.msleeping = 0;
                monster.mpeaceful = 0;
                monster.mtame = 0;
                setMonsterMalign(monster);
            } else {
                monster = await makemon(null, position.x, position.y, flags);
                if (monster) {
                    const replacementClass = MONSTER_SYMBOL[monster.mnum] ?? 0;
                    if ((difficultyCap > 0 && (MONSTER_DIFFICULTY[monster.mnum] ?? 0) >= difficultyCap
                        && rn2(In_endgame(game.u.uz) ? 3 : 7)
                        && (MONSTER_ATTACKS[monster.mnum] ?? []).some(([type]) => type === 255))
                        || (summonerClass === S_DEMON_WIZ && replacementClass === S_ANGEL_WIZ)
                        || (summonerClass === S_ANGEL_WIZ && replacementClass === S_DEMON_WIZ)) {
                        await unmakeNastySubstitute(monster);
                        monster = null;
                    }
                }
            }
            if (!monster) continue;

            if (monster.mnum === archLich || monster.mnum === archon) {
                if (!difficultyCap || difficultyCap > lowerArchDifficulty)
                    difficultyCap = lowerArchDifficulty;
            }
            monster.mspec_used = rnd(4);
            created.push(monster);
            const monsterAlignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
            if (created.length >= 10
                || monsterAlignment === 0
                || Math.sign(monsterAlignment) === casterAlignment) {
                break;
            }
        }
    }

    return { count: created.length ? nastyMonsterCensus() - census : 0, created };
}

// Part of C wizard.c:pick_nasty(): draw a species from the nasty-monster table.
function pickNastyCandidate(): number {
    const result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    if (result === undefined) throw new RangeError('Nasty monster selection is outside its species list');
    return result;
}
