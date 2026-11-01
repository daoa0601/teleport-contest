// C wizard.c: Amulet effects and Wizard harassment.
import { game } from './gstate.js';
import { artifactById } from './artifacts.js';
import { monsterName } from './do_name.js';
import { displayColorName, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { makemonNear, summonNastyMonsters } from './mklev.js';
import { setMonsterMalign } from './makemon.js';
import { monsterAlignmentType } from './priest.js';
import { BOLT_LIM, Is_astralevel, Is_rogue_level, isok, MAGIC_PORTAL, M_AP_MONSTER, MM_NOWAIT, RLOC_MSG, STRAT_APPEARMSG, STRAT_GROUND, STRAT_HEAL, STRAT_MONSTR, STRAT_PLAYER, STRAT_WAITFORU, STRAT_WAITMASK, } from './const.js';
import { msummon } from './minion.js';
import { formatFeltMessage } from './hero_speech.js';
import { rndcurse } from './throne.js';
import { dungeonBuildsUp, insideWizardTower } from './dungeon.js';
import { monsterIsHelpless } from './mondata.js';
import { mksobj } from './mkobj.js';
import { linkObjectToMonsterInventory } from './mkobj.js';
import { addObjectToMonsterInventory } from './steal.js';
import { recordRandom } from './monster_action_types.js';
import { MONSTER_DIFFICULTY, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterClassSymbol, } from './monster_data.js';
import { catchUpMonster, monsterArrive, WIZ_ARRIVE, } from './dog.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD, } from './object_data.js';
import { FAKE_AMULET_OF_YENDOR } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { definiteObjectAction, observeDistantObjectForNaming } from './objnam.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { monsterAtPosition } from './steed.js';
import { questMonsterFlags3 } from './role_monsters.js';
import { expelHero } from './hero_expulsion.js';
import { healMonster, monsterIndexByName, speciesWasGenocided, mnearto } from './mon.js';
import { randomMonsterRelocation, relocateMonsterTo } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { deliverCommonQuestInsult } from './quest_pager.js';
import { remove_object } from './floor_object.js';
import { objectDescription } from './object_description.js';
import { priestIsInOwnTemple } from './priest.js';
import { shopkeeperInOwnShop } from './shk.js';
import { cansee } from './vision.js';
const WIZARD = 285;
// C wizard.c:amulet(). Called once per global turn while carrying the Amulet.
export async function amuletTurn(state) {
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
    if (!state.context.no_of_wizards)
        return;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !monster.iswiz || !monster.msleeping || rn2(40))
            continue;
        monster.msleeping = 0;
        if (Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) > 1)
            await plineWithContinuation('You get the creepy feeling that somebody noticed your taking the Amulet.');
        return;
    }
}
// C wizard.c:intervene(). Paging suspends the whole intervention before
// its caller restarts the countdown and continues environmental maintenance.
export async function intervene() {
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
            if (effect.deferredDemonSummon)
                effect = await msummon();
            game._lastDemigodNasty = effect.created.map(monster => monster.m_id);
            break;
        }
        case 5:
            await resurrectWizard();
            break;
    }
}
// Removal counts even when the Wizard leaves alive. The first removal starts
// demigod intervention; later deaths must not restart an existing countdown.
// C wizard.c:wizdeadorgone().
export function wizardDeadOrGone(state = game, random = rn2) {
    state.context.no_of_wizards = (state.context.no_of_wizards ?? 0) - 1;
    const events = state.u.uevent ??= {};
    if (!events.udemigod) {
        events.udemigod = true;
        state.u.udg_cnt = 50 + random(250);
    }
}
export function monsterCarriesAmulet(monster) {
    // C wizard.c:mon_has_amulet() searches only the top-level inventory.
    return (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR);
}
// C wizard.c:mon_has_special() excludes objects inside carried containers.
export function monsterCarriesSpecialObject(monster, state = game) {
    return (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR
        || artifactById(object.oartifact, state)?.questArtifact
        || object.otyp === BELL_OF_OPENING
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === SPE_BOOK_OF_THE_DEAD);
}
function monsterHelpless(monster) {
    // C mon.c:helpless().
    return !monster.mcanmove || !!monster.msleeping;
}
async function recallMigratingWizard() {
    // C wizard.c:resurrect() migrating_mons scan.  Returns a placed wizard
    // or null; placement failure re-queues the monster for later attempts.
    // Migration arrays append where C prepends to migrating_mons.
    for (const candidate of [...(game._migratingMonsters ?? [])].reverse()) {
        if (!candidate.iswiz)
            continue;
        // if he has the Amulet, he won't bring it to you
        if (monsterCarriesAmulet(candidate))
            continue;
        let elapsed = (game.moves ?? 0) - (candidate.mlstmv ?? game.moves ?? 0);
        if (!(elapsed > 0))
            continue;
        await catchUpMonster(candidate, elapsed, game);
        if (elapsed >= 0x7fffffff)
            elapsed = 0x7fffffff - 1;
        elapsed = Math.trunc(elapsed / 50);
        if (candidate.msleeping && rn2(elapsed + 1))
            candidate.msleeping = 0;
        if (candidate.mfrozen === 1) {
            // would unfreeze on next move
            candidate.mfrozen = 0;
            candidate.mcanmove = 1;
        }
        if (monsterHelpless(candidate))
            continue;
        // mon_arrive() might have sent him into limbo again; only a placed
        // wizard counts as resurrected.
        return monsterArrive(candidate, WIZ_ARRIVE, game)
            .then(placed => placed ? candidate : null);
    }
    return null;
}
// C wizard.c:resurrect().
export async function resurrectWizard() {
    let wizard = null;
    let verb = 'kill';
    if (!game.context?.no_of_wizards) {
        wizard = await makemonNear(WIZARD, game.u.ux, game.u.uy, MM_NOWAIT);
        if (wizard) {
            // he's not coming back from a corpse but is subject to repeated
            // killing like a revived corpse
            wizard.mrevived = 1;
        }
    }
    else {
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
export function monsterSpellHasAggravatables(caster, state) {
    const inTower = insideWizardTower(caster.mx, caster.my, state);
    if (inTower !== insideWizardTower(state.u.ux, state.u.uy, state))
        return false;
    return state.level.monsters.some((monster) => !monster.dead &&
        (monster.mhp ?? 1) > 0 &&
        insideWizardTower(monster.mx, monster.my, state) === inTower &&
        ((monster.mstrategy ?? 0) & STRAT_WAITFORU ||
            monsterIsHelpless(monster)));
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
export async function finishWizardClone(clone, state, random, calls) {
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
        const appearanceIndex = recordRandom(random, calls, WIZARD_CLONE_APPEARANCE_NAMES.length);
        clone.m_ap_type = M_AP_MONSTER;
        clone.mappearance = MONSTER_NAME.indexOf(WIZARD_CLONE_APPEARANCE_NAMES[appearanceIndex] ?? '');
    }
    await newsym(clone.mx, clone.my);
    return clone;
}
// C wizard.c:aggravate().
export function aggravateMonsters(state = game, random = rn2) {
    const heroInsideTower = insideWizardTower(state.u?.ux, state.u?.uy, state);
    const awakened = [];
    // Native fmon visits the most recently created monster first.
    for (const monster of Array.from(state.level?.monsters || []).reverse()) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
            continue;
        if (insideWizardTower(monster.mx, monster.my, state)
            !== heroInsideTower)
            continue;
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
        if (wasSleeping || wasWaiting || unfroze)
            awakened.push(monster);
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
export function chooseCovetousStrategy(monster, state) {
    const { strategy, goal } = decideCovetousStrategy(monster, state);
    if (goal)
        monster.mgoal = goal;
    const target = strategy.kind === 'target' ? strategy.target : null;
    const flags = strategy.kind === 'heal' ? STRAT_HEAL
        : target ? target.mask | (target.kind === 'hero' ? STRAT_PLAYER
            : target.kind === 'floor' ? STRAT_GROUND : STRAT_MONSTR) : 0;
    monster.mstrategy = ((monster.mstrategy ?? 0) & (STRAT_WAITMASK | STRAT_APPEARMSG)) | flags;
    return strategy;
}
function decideCovetousStrategy(monster, state) {
    if (shopkeeperInOwnShop(monster, state) || priestIsInOwnTemple(monster, state))
        return { strategy: { kind: 'harass' }, goal: undefined };
    const health = Math.trunc(monster.mhp * 3 / monster.mhpmax);
    if (health < 1 || health > 3 || health === 1 && MONSTER_NAME[monster.mnum] !== 'Wizard of Yendor')
        return { strategy: { kind: 'heal' }, goal: undefined };
    const masks = state.context.made_amulet ? [WANTS_AMULET] : [];
    masks.push(...(state.u.uevent?.invoked
        ? [WANTS_ARTIFACT, WANTS_BOOK, WANTS_BELL, WANTS_CANDELABRUM]
        : [WANTS_BOOK, WANTS_BELL, WANTS_CANDELABRUM, WANTS_ARTIFACT]));
    let goal;
    for (const mask of masks) {
        if (!(questMonsterFlags3(monster.mnum, state) & mask))
            continue;
        const target = findCovetousTarget(monster, mask, state);
        if (target) {
            return { strategy: { kind: 'target', target }, goal: { ...target.position } };
        }
        goal = { x: 0, y: 0 };
    }
    return { strategy: { kind: health < 3 ? 'heal' : 'harass' }, goal };
}
function findCovetousTarget(monster, mask, state) {
    if (!(questMonsterFlags3(monster.mnum, state) & mask))
        return null;
    const matches = (object) => objectMatchesTarget(object, mask, state);
    if (!(monster.minvent ?? []).some(matches)) {
        if (heroHasTarget(mask, state))
            return { kind: 'hero', position: { x: state.u.ux, y: state.u.uy }, mask };
        const floor = state.level.objects.flatMap(column => (column ?? []).flatMap(pile => pile ?? []))
            .filter(matches).sort((a, b) => (b._fobjOrder ?? 0) - (a._fobjOrder ?? 0))[0];
        if (floor)
            return { kind: 'floor', position: { x: floor.ox, y: floor.oy }, mask, object: floor };
        // other_mon_has_arti() considers the first fmon carrier before the
        // Amulet exception; it does not search past an excluded carrier.
        const carrier = [...state.level.monsters].reverse().find(candidate => candidate !== monster && (candidate.minvent ?? []).some(matches));
        if (carrier && (mask !== WANTS_AMULET || !carrier.iswiz && !priestIsInOwnTemple(carrier, state)))
            return { kind: 'monster', position: { x: carrier.mx, y: carrier.my }, mask };
    }
    return null;
}
function objectMatchesTarget(object, mask, state) {
    if (mask === WANTS_AMULET)
        return object.otyp === AMULET_OF_YENDOR;
    if (mask === WANTS_BELL)
        return object.otyp === BELL_OF_OPENING;
    if (mask === WANTS_BOOK)
        return object.otyp === SPE_BOOK_OF_THE_DEAD;
    if (mask === WANTS_CANDELABRUM)
        return object.otyp === CANDELABRUM_OF_INVOCATION;
    return !!object.questArtifact || !!artifactById(object.oartifact, state)?.questArtifact;
}
function heroHasTarget(mask, state) {
    const owns = state.u.uhave;
    if (mask === WANTS_AMULET)
        return !!owns?.amulet;
    if (mask === WANTS_BELL)
        return !!owns?.bell;
    if (mask === WANTS_BOOK)
        return !!owns?.book;
    if (mask === WANTS_CANDELABRUM)
        return !!owns?.menorah;
    return !!owns?.questart;
}
export async function pursueCovetousTarget(monster, target, state) {
    const { x, y } = target.position;
    if (!target.mask || !isok(x, y))
        return 'continued';
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
async function approachTarget(monster, x, y, restricted, state) {
    const oldx = monster.mx, oldy = monster.my;
    if (restricted || !await mnearto(monster, x, y, state, { flags: RLOC_MSG }))
        await relocateMonsterTo(monster, oldx, oldy, { state });
}
// C wizard.c:tactics(STRAT_HEAL), including choose_stairs() and the
// fall-through to harassment when the monster cannot heal at a distance.
export async function retreatCovetousMonster(monster, state, random = rn2, rollOne = rnd) {
    monster.mstrategy = ((monster.mstrategy ?? 0) & (STRAT_WAITMASK | STRAT_APPEARMSG)) | STRAT_HEAL;
    let healingX = monster.mx, healingY = monster.my;
    if (state.u.uswallow && state.u.ustuck === monster) {
        const expelled = await expelHero(monster, { state, random, rollOne });
        if (expelled.died)
            return 'blocked';
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
    }
    else if (stairs && (healingX !== stairs.sx || healingY !== stairs.sy)) {
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
export function chooseStairs(dir, state) {
    const stairs = [];
    for (let stair = state.stairs; stair; stair = stair.next)
        stairs.push(stair);
    // With no stairway at all, C's stairway_find_type_dir() loop never runs;
    // skip builds_up() too, which needs an initialized dungeon list.
    if (!stairs.length)
        return null;
    const up = dungeonBuildsUp(state.u.uz, state) ? dir : !dir;
    return stairs.find(stair => !stair.isladder && stair.up === up)
        ?? stairs.find(stair => stair.isladder && stair.up === up)
        ?? stairs.find(stair => stair.tolev.dnum !== state.u.uz.dnum)
        ?? stairs.find(stair => !stair.isladder && stair.up !== up)
        ?? stairs.find(stair => stair.isladder && stair.up !== up)
        ?? null;
}
// C wizard.c:cuss(), shared by monster turns and sounds.c:domonnoise().
const M2_MINION = 0x00001000;
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
export async function publishMonsterCuss(monster, state, random = rn2) {
    if (heroIsDeaf(state))
        return;
    const minion = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MINION);
    const extension = monster.emin ?? monster.mextra?.emin;
    if (monster.iswiz) {
        await plineWithContinuation(selectWizardCussMessage(monster, state, random));
    }
    else if (minion && monsterAlignmentType(monster) === 1
        && !(monster.isminion && extension?.renegade)) {
        await deliverCommonQuestInsult('angel_cuss', state);
    }
    else if (!random(minion ? 100 : 5)) {
        await plineWithContinuation(`${monsterName(monster, { capitalized: true, state })} casts aspersions on your ancestry.`);
    }
    else {
        await deliverCommonQuestInsult('demon_cuss', state);
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 25, state);
}
function selectWizardCussMessage(monster, game, roll) {
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
    return '"' + WIZARD_CUSS_MALEDICTIONS[roll(WIZARD_CUSS_MALEDICTIONS.length)] + ' ' + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)] + '!"';
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
const NASTY_SHAPE_DEMOTIONS = [
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
const NASTY_BIG_TO_LITTLE = new Map(NASTY_SHAPE_DEMOTIONS.map(([large, small]) => [
    monsterIndexByName(large), monsterIndexByName(small),
]));
export function pickNastyShape(difficultyCap) {
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
function pickNastyCandidate() {
    const result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    if (result === undefined)
        throw new RangeError('Nasty monster selection is outside its species list');
    return result;
}
//# sourceMappingURL=wizard.js.map