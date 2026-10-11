// Per-game state. Construction allocates containers; native startup owns values.
import { CommandBindings } from './command_bindings.js';
import { createHeroState } from './hero_types.js';
export function createGameState() {
    return {
        u: createHeroState(), urole: null, urace: null, initAlignment: null,
        context: { move: 0 }, program_state: {}, flags: {}, iflags: {},
        commandBindings: new CommandBindings(), moves: 0, multi: 0,
        inventory: [], spells: [],
        level: null, dungeons: [], branches: [], stairs: null,
        nhDisplay: null, storage: null, mockStorage: null,
        coreCtx: null, displayCtx: null, datetime: null,
        nethackrc: '', plname: '', displayName: '',
        _monsterSwallower: null, _monsterEngulf: null, warn_obj_cnt: 0,
        bhitpos: { x: 0, y: 0 }, notonhead: false,
        _pending_message: '', _retained_message: '', _last_message: '',
        _lastPlineMessage: '', _screen_output: '',
    };
}
//# sourceMappingURL=game_state.js.map