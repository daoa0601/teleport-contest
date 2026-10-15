// Options may be absent until their owning startup step supplies a default.
// A closed list keeps misspelled configuration names out of saved game state.
export type GameBooleanFlag =
    | 'accessiblemsg' | 'acoustics' | 'armorstatus'
    | 'autodig' | 'autoopen' | 'pickup' | 'autoquiver' | 'checkpoint'
    | 'cmdassist' | 'color' | 'confirm' | 'customcolors' | 'customsymbols'
    | 'dark_room' | 'dropped_nopick' | 'extmenu'
    | 'fireassist' | 'fixinv' | 'force_invmenu' | 'goldX' | 'help'
    | 'herecmd_menu' | 'hilite_pet' | 'hilite_pile' | 'hitpointbar'
    | 'ignintr' | 'implicit_uncursed' | 'lit_corridor' | 'lootabc' | 'mail'
    | 'mention_decor' | 'mention_map' | 'mention_walls' | 'menu_overlay'
    | 'menucolors' | 'mon_movement' | 'null' | 'pickup_stolen'
    | 'pickup_thrown' | 'price_quotes' | 'pushweapon' | 'query_menu'
    | 'quick_farsight' | 'rest_on_space' | 'safe_pet' | 'safe_wait'
    | 'showdamage' | 'showexp' | 'showrace' | 'showvers' | 'silent'
    | 'sortpack' | 'sparkle' | 'spot_monsters' | 'standout' | 'terrainstatus'
    | 'time' | 'tips' | 'tombstone' | 'travel' | 'use_inverse' | 'verbose'
    | 'weaponstatus'
    | 'beginner' | 'blind' | 'bones' | 'deaf' | 'debug' | 'explore' | 'female'
    | 'friday13' | 'legacy' | 'made_fruit' | 'nudist' | 'pauper' | 'reroll'
    | 'safe_dog' | 'tutorial';

export type MenuStyle = 0 | 1 | 2 | 3;
export type LootSortMode = 'n' | 'l' | 'f';

export interface GameFlags extends Partial<Record<GameBooleanFlag, boolean>> {
    statusConditionMask?: number;
    versinfo?: number;
    autounlock?: string | number | boolean;
    debug_fuzzer?: number;
    disclose?: string;
    end_top?: number;
    end_around?: number;
    end_own?: boolean;
    initalign?: number;
    initgend?: number;
    inv_order?: number[];
    menu_style?: MenuStyle;
    moonphase?: number | null;
    paranoia_bits?: number;
    pettype?: string;
    dogname?: string;
    catname?: string;
    horsename?: string;
    pickup_burden?: string | number;
    pickup_types?: string;
    pile_limit?: string | number;
    runmode?: string;
    sortloot?: LootSortMode;
    suppress_alert?: string;
    /** insight.c vanq_sortmode: VANQ_* order of vanquished/genocided lists. */
    vanqSortmode?: number;
}

export interface InterfaceFlags {
    altmeta?: boolean;
    autodescribe?: boolean;
    debug_fuzzer?: boolean;
    debug_hunger?: boolean;
    debug_overwrite_stairs?: boolean;
    getdir_click?: number;
    remember_getpos?: boolean;
    getloc_travelmode?: boolean;
    getpos_coords?: 'n' | 'm' | 's' | 'c' | 'f';
    getloc_filter?: 0 | 1 | 2;
    getloc_usemenu?: boolean;
    getloc_moveskip?: boolean;
    in_lava_effects?: number;
    menu_requested?: boolean;
    menu_headings?: { attr: number; color: number };
    menuinvertmode?: 0 | 1 | 2;
    menu_tab_sep?: boolean;
    nofollowers?: boolean;
    num_pad?: boolean;
    num_pad_mode?: number;
    override_ID?: boolean;
    suppress_price?: boolean;
    wizmgender?: boolean;
    wizweight?: boolean;
    partly_eaten_hack?: boolean;
    prevmsg_window?: string;
    terrain_typ?: number;
    terrainmode?: number;
    toptenwin?: boolean;
    travelcc?: { x: number; y: number };
    use_inverse?: boolean;
    wc_eight_bit_input?: boolean;
    wc_inverse?: boolean;
    wc_splash_screen?: boolean;
}
