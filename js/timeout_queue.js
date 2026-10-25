// C timeout.c:wiz_timeout_queue() — the #timeout debug listing: current
// time, the timer queue, every timed intrinsic, and the hero/level counters
// that share this status surface.
import { OBJECT_TIMER_KIND, queuedTimers } from './object_timers.js';
import { propertyTimeout } from './properties.js';
import { showTextWindow } from './windows.js';
import { game, requireGameLevel, requireInitializedGame } from './gstate.js';
// timeout.c:propertynames[], C order. Hallucination resistance is listed
// here (unlike the #wizintrinsic table, which omits Grayswandir's property).
const PROPERTY_NAMES = [
    { name: 'invulnerable', property: 'invulnerable' },
    { name: 'petrifying', property: 'stoned' },
    { name: 'becoming slime', property: 'slimed' },
    { name: 'strangling', property: 'strangled' },
    { name: 'fatally sick', property: 'sick' },
    { name: 'stunned', property: 'stunned' },
    { name: 'confused', property: 'confusion' },
    { name: 'hallucinating', property: 'hallucination' },
    { name: 'blinded', property: 'blinded' },
    { name: 'deafness', property: 'deaf' },
    { name: 'vomiting', property: 'vomiting' },
    { name: 'slippery fingers', property: 'glib' },
    { name: 'wounded legs', property: 'woundedLegs' },
    { name: 'sleepy', property: 'sleepy' },
    { name: 'teleporting', property: 'teleportation' },
    { name: 'polymorphing', property: 'polymorph' },
    { name: 'levitating', property: 'levitation' },
    { name: 'very fast', property: 'fast' },
    { name: 'clairvoyant', property: 'clairvoyant' },
    { name: 'monster detection', property: 'detectMonsters' },
    { name: 'see invisible', property: 'seeInvisible' },
    { name: 'invisible', property: 'invisible' },
    { name: 'acid resistance', property: 'acidResistance' },
    { name: 'stoning resistance', property: 'stoneResistance' },
    { name: 'displaced', property: 'displaced' },
    { name: 'pass thru walls', property: 'passesWalls' },
    { name: 'magical breathing', property: 'magicalBreathing' },
    { name: 'water walking', property: 'waterWalking' },
    { name: 'fire resistance', property: 'fireResistance' },
    // Entries from here on only obtain timeouts through #wizintrinsic.
    { name: 'cold resistance', property: 'coldResistance' },
    { name: 'sleep resistance', property: 'sleepResistance' },
    { name: 'disintegration resistance', property: 'disintegrationResistance' },
    { name: 'shock resistance', property: 'shockResistance' },
    { name: 'poison resistance', property: 'poisonResistance' },
    { name: 'drain resistance', property: 'drainResistance' },
    { name: 'sickness resistance', property: 'sicknessResistance' },
    { name: 'magic resistance', property: 'antimagic' },
    { name: 'hallucination resistance', property: 'hallucinationResistance' },
    { name: 'light-induced blindness resistance', property: 'blindResistance' },
    { name: 'fumbling', property: 'fumbling' },
    { name: 'voracious hunger', property: 'hunger' },
    { name: 'telepathic', property: 'telepathy' },
    { name: 'warning', property: 'warning' },
    { name: 'warn: monster type or class', property: 'warnOfMonster' },
    { name: 'warn: undead', property: 'warnUndead' },
    { name: 'searching', property: 'searching' },
    { name: 'infravision', property: 'infravision' },
    { name: 'adorned (+/- Cha)', property: 'adorned' },
    { name: 'stealthy', property: 'stealth' },
    { name: 'monster aggravation', property: 'aggravateMonster' },
    { name: 'conflict', property: 'conflict' },
    { name: 'jumping', property: 'jumping' },
    { name: 'teleport control', property: 'teleportControl' },
    { name: 'flying', property: 'flying' },
    { name: 'swimming', property: 'swimming' },
    { name: 'slow digestion', property: 'slowDigestion' },
    { name: 'half spell damage', property: 'halfSpellDamage' },
    { name: 'half physical damage', property: 'halfPhysicalDamage' },
    { name: 'HP regeneration', property: 'regeneration' },
    { name: 'energy regeneration', property: 'energyRegeneration' },
    { name: 'extra protection', property: 'protection' },
    { name: 'protection from shape changers', property: 'protectionFromShapeChangers' },
    { name: 'polymorph control', property: 'polymorphControl' },
    { name: 'unchanging', property: 'unchanging' },
    { name: 'reflecting', property: 'reflection' },
    { name: 'free action', property: 'freeAction' },
    { name: 'fixed abilities', property: 'sustainAbility' },
    { name: 'life will be saved', property: 'lifeSaving' },
];
const WIZINTRINSIC_ONLY_INDEX = PROPERTY_NAMES.findIndex(entry => entry.property === 'coldResistance');
const TIMER_FUNC_NAMES = {
    [OBJECT_TIMER_KIND.ROT_ORGANIC]: 'rot_organic',
    [OBJECT_TIMER_KIND.ROT_CORPSE]: 'rot_corpse',
    [OBJECT_TIMER_KIND.REVIVE_MON]: 'revive_mon',
    [OBJECT_TIMER_KIND.ZOMBIFY_MON]: 'zombify_mon',
    [OBJECT_TIMER_KIND.BURN_OBJECT]: 'burn_object',
    [OBJECT_TIMER_KIND.HATCH_EGG]: 'hatch_egg',
    [OBJECT_TIMER_KIND.FIG_TRANSFORM]: 'fig_transform',
    [OBJECT_TIMER_KIND.SHRINK_GLOB]: 'shrink_glob',
    'melt-ice-away': 'melt_ice_away',
};
// timeout.c:print_queue(). C shows fmt_ptr() of the timer argument: the
// packed (x << 16 | y) spot coordinate for level timers and the object
// address for object timers. Object addresses belong to the native heap, so
// the port shows the object's stable id in the same 0x-prefixed shape.
function timerQueueLines(state) {
    const timers = queuedTimers(state);
    if (!timers.length)
        return [' <empty>'];
    const rows = ['timeout  id   kind   call'];
    for (const entry of timers) {
        const funcName = TIMER_FUNC_NAMES[entry.timer.kind];
        if (!funcName)
            throw new Error(`No timer callback name for ${entry.timer.kind}`);
        const argument = 'object' in entry
            ? `0x${entry.object.o_id.toString(16)}`
            : `0x${((entry.position.x << 16) | entry.position.y).toString(16)}`;
        rows.push(` ${String(entry.timer.deadline).padStart(4)}   `
            + `${String(entry.timer.id).padStart(4)}  `
            + `${'object' in entry ? 'object' : 'level'}`.padEnd(6)
            + ` ${funcName}(${argument})`);
    }
    return rows;
}
function timedPropertyLines(state) {
    const timed = PROPERTY_NAMES
        .map((entry, index) => ({ ...entry, index, timeout: propertyTimeout(entry.property, state) }))
        .filter(entry => entry.timeout > 0);
    if (!timed.length)
        return ['No timed properties.'];
    const longest = Math.max(...timed.map(entry => entry.name.length));
    const lines = ['Timed properties:', ''];
    let markerPending = true;
    for (const entry of timed) {
        if (markerPending && entry.index >= WIZINTRINSIC_ONLY_INDEX) {
            lines.push(' -- settable via #wizintrinsic only --');
            markerPending = false;
        }
        lines.push(` ${entry.name.padEnd(longest)} ${String(entry.timeout).padStart(4)}`);
    }
    return lines;
}
// region.c:visible_region_summary().
function visibleRegionLines(state) {
    const visible = requireGameLevel(state).regions
        .filter(region => region.visible && region.ttl !== -2);
    if (!visible.length)
        return [];
    const separator = state.iflags.menu_tab_sep ? '\t' : '  ';
    const lines = ['', 'Visible regions'];
    for (const region of visible) {
        const type = region.damage
            ? `poison gas (${region.damage})` : 'vapor';
        const xs = region.cells.map(cell => cell.x);
        const ys = region.cells.map(cell => cell.y);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        lines.push(`${String(region.ttl + 1).padStart(5)}${separator}${type.padEnd(16)}`
            + `${separator}@[${left},${top}..${right},${bottom}]`);
    }
    return lines;
}
export async function wizTimeoutQueue() {
    const state = requireInitializedGame();
    const lines = [
        `Current time = ${state.moves ?? 0}.`,
        '',
        'Active timeout queue:',
        '',
        ...timerQueueLines(state),
        '',
        ...timedPropertyLines(state),
    ];
    const hero = state.u;
    if (hero.uswldtim) {
        lines.push('', `Swallow countdown is ${hero.uswldtim}.`);
    }
    if (hero.uinvault) {
        lines.push('', `Vault counter is ${hero.uinvault}.`);
    }
    lines.push(...visibleRegionLines(state));
    const stasisUntil = requireGameLevel(state).flags.stasis_until;
    if (stasisUntil !== undefined && stasisUntil >= (state.moves ?? 0)) {
        const turns = stasisUntil - (state.moves ?? 0);
        lines.push('', `Level is no-teleport for ${turns + 1} ${turns > 0 ? 'turns' : 'more turn'}.`);
    }
    await showTextWindow(lines);
    state._pending_message = '';
    state.context.move = 0;
}
//# sourceMappingURL=timeout_queue.js.map