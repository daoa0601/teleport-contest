// Per-game state. Construction allocates containers; native startup owns values.
import { CommandBindings } from './command_bindings.js';
import { createHeroState } from './hero_types.js';
export function createGameState() {
    return {
        u: createHeroState(), urole: null, urace: null, initAlignment: null,
        context: { move: 0 }, program_state: {}, flags: {}, iflags: {},
        // C decl.c g_init_h starts hero_seq at 1<<3: the first hero action
        // of the opening turn is sequence 8, never 0, so eshk breakage
        // tracking refreshes seq_peaceful on the very first break.
        commandBindings: new CommandBindings(), moves: 0, multi: 0,
        _heroActionSeq: 8,
        inventory: [], spells: [],
        level: null, dungeons: [], branches: [], stairs: null,
        nhDisplay: null, storage: null, mockStorage: null,
        coreCtx: null, displayCtx: null, datetime: null,
        nethackrc: '', plname: '', displayName: '',
        _monsterSwallower: null, _monsterEngulf: null, warn_obj_cnt: 0, _magicKeyTrapWarningCount: 0,
        bhitpos: { x: 0, y: 0 }, notonhead: false,
        _pending_message: '', _retained_message: '', _last_message: '',
        _toplines: '', _messageHistory: [], _messageHistoryWriteIndex: 0,
        _messageHistoryCursor: null, _promptOwnsTopline: false,
        _toplineGlyphPainted: false,
        _lastPlineMessage: '', earlyRawMessages: 0, _screen_output: '',
    };
}
//# sourceMappingURL=game_state.js.map