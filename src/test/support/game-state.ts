import type { MonsterVital } from '../../js/monster_types.js';
import type { GameState, PlayingGameState, Fruit } from '../../js/game_state.js';
import type { InitializedHero } from '../../js/hero_types.js';
import type { GameObject } from '../../js/object_types.js';
import type { Role, RoleKey, Race, AttributeValues } from '../../js/roles.js';
import { COLNO, COULD_SEE, IN_SIGHT, MAXULEV, ROWNO } from '../../js/const.js';
import { GameMap } from '../../js/game.js';
import { resetGame, requirePlayingGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { races, roles } from '../../js/roles.js';
import { initializeHeroSpecies } from '../../js/u_init.js';
import { initializeHeroRoomMembership } from '../../js/room.js';
import { initializeMonsterVitals } from '../../js/monster_population.js';
import { initializeFruitRegistry } from '../../js/fruit.js';

export interface FixtureGameState extends PlayingGameState {
    mvitals: MonsterVital[];
    fruits: Fruit[];
}

export function requireFixtureGame(state: GameState): asserts state is FixtureGameState {
    requirePlayingGame(state);
    if (!state.mvitals) throw new Error('The game fixture needs initialized monster vitals');
    if (!state.fruits) throw new Error('The game fixture needs an initialized fruit registry');
}

export interface FreshGameOptions {
    level?: GameMap;
    role?: RoleKey | Role;
    race?: Race;
    heroX?: number;
    heroY?: number;
    hero?: Partial<InitializedHero>;
    flags?: GameState['flags'];
    iflags?: GameState['iflags'];
    context?: Partial<GameState['context']>;
    moves?: number;
    inventory?: GameObject[];
}

function attributes(value: number): AttributeValues {
    return [value, value, value, value, value, value];
}

function visibleGrid(): Uint8Array[] {
    return Array.from(
        { length: ROWNO },
        () => new Uint8Array(COLNO).fill(COULD_SEE | IN_SIGHT),
    );
}

export function freshGame({
    level = new GameMap(),
    role = 'archeologist',
    race = races.find(candidate => candidate.name === 'human'),
    heroX = 10,
    heroY = 10,
    hero = {},
    flags = { verbose: true, autoopen: true, pickup: false },
    iflags = {},
    context = { move: 0, forcefight: false, nopick: false },
    moves = 1,
    inventory = [],
}: FreshGameOptions = {}): FixtureGameState {
    if (!race) throw new Error('The native human race is required');
    const roleKey = typeof role === 'string' ? role : role.key;
    const roleData = roles.find(candidate => candidate.key === roleKey);
    if (!roleData) throw new Error(`Unknown hero role: ${roleKey}`);
    const u: InitializedHero = {
        uz: { dnum: 0, dlevel: 1 },
        ux: heroX, uy: heroY, ux0: heroX, uy0: heroY,
        uhp: 12, uhpmax: 12, uhppeak: 12, uhpinc: Array.from({ length: MAXULEV }, (_, level) => level === 0 ? 12 : 0),
        uen: 0, uenmax: 0, uenpeak: 0, ueninc: Array.from({ length: MAXULEV }, () => 0),
        uac: 10, ulevel: 1, ulevelmax: hero.ulevel ?? 1,
        ulevelpeak: (hero.ulevel ?? 1) > 1 ? hero.ulevel ?? 1 : 0,
        uexp: 0, urexp: 0, ublesscnt: 0,
        uhunger: 900, uhs: 0,
        acurr: { a: attributes(10) }, amax: { a: attributes(10) },
        atemp: { a: attributes(0) },
        ualign: { type: 1, record: 10 }, ualignbase: [1, 1],
        uroleplay: {
            pauper: false, nudist: false, reroll: false,
            numrerolls: 0, blind: false, deaf: false,
        },
        rightHanded: true, umovement: 12,
        umonster: roleData.mnum, umonnum: roleData.mnum, ulycn: -1,
        mh: 0, mhmax: 0, mtimedone: 0, nv_range: 1, xray_range: -1,
        uconduct: {}, uhave: {},
        urooms: [], urooms0: [], uentered: [],
        ushops: [], ushops0: [], ushops_entered: [], ushops_left: [],
        weaponSkills: null, skillRecord: [], weapon_slots: 0,
    };
    const state = resetGame();
    state.level = level;
    state.u = u;
    state.urole = typeof role === 'string' ? roleData : role;
    state.urace = race;
    state.flags = flags;
    state.iflags = iflags;
    state.context = { move: 0, ...context };
    state.program_state = {};
    state.moves = moves;
    state.viz_array = visibleGrid();
    state.inventory = inventory;
    state.uwep = null;
    state.uswapwep = null;
    state.uquiver = null;
    state.animationFrame = async () => {};
    initializeMonsterVitals(state);
    initializeHeroSpecies(state);
    initializeHeroRoomMembership(state);
    const configuredHero: InitializedHero = { ...u, ...hero };
    state.u = configuredHero;
    initializeFruitRegistry(undefined, state);
    resetInputState();
    requireFixtureGame(state);
    return state;
}
