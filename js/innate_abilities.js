// C attrib.c role_abil[] and race ability tables.
export const ROLE_LEVEL_ABILITIES = {
    archeologist: [
        [1, 'searching', '', ''],
        [5, 'stealth', 'stealthy', ''], [10, 'fast', 'quick', 'slow'],
    ],
    barbarian: [
        [1, 'poisonResistance', '', ''],
        [7, 'fast', 'quick', 'slow'], [15, 'stealth', 'stealthy', ''],
    ],
    caveman: [
        [7, 'fast', 'quick', 'slow'], [15, 'warning', 'sensitive', ''],
    ],
    healer: [[1, 'poisonResistance', '', ''], [15, 'warning', 'sensitive', '']],
    knight: [[7, 'fast', 'quick', 'slow']],
    monk: [
        [1, 'fast', '', ''], [1, 'sleepResistance', '', ''],
        [1, 'seeInvisible', '', ''],
        [3, 'poisonResistance', 'healthy', ''],
        [5, 'stealth', 'stealthy', ''],
        [7, 'warning', 'sensitive', ''],
        [9, 'searching', 'perceptive', 'unaware'],
        [11, 'fireResistance', 'cool', 'warmer'],
        [13, 'coldResistance', 'warm', 'cooler'],
        [15, 'shockResistance', 'insulated', 'conductive'],
        [17, 'teleportControl', 'controlled', 'uncontrolled'],
    ],
    priest: [
        [15, 'warning', 'sensitive', ''],
        [20, 'fireResistance', 'cool', 'warmer'],
    ],
    ranger: [
        [1, 'searching', '', ''],
        [7, 'stealth', 'stealthy', ''], [15, 'seeInvisible', '', ''],
    ],
    rogue: [[1, 'stealth', '', ''], [10, 'searching', 'perceptive', '']],
    samurai: [[1, 'fast', '', ''], [15, 'stealth', 'stealthy', '']],
    tourist: [
        [10, 'searching', 'perceptive', ''],
        [20, 'poisonResistance', 'hardy', ''],
    ],
    valkyrie: [
        [1, 'coldResistance', '', ''],
        [3, 'stealth', 'stealthy', ''], [7, 'fast', 'quick', 'slow'],
    ],
    wizard: [
        [15, 'warning', 'sensitive', ''],
        [17, 'teleportControl', 'controlled', 'uncontrolled'],
    ],
};
export const RACE_LEVEL_ABILITIES = {
    dwarf: [[1, 'infravision', '', '']],
    elf: [[1, 'infravision', '', ''], [4, 'sleepResistance', 'awake', 'tired']],
    gnome: [[1, 'infravision', '', '']],
    orc: [[1, 'infravision', '', ''], [1, 'poisonResistance', '', '']],
};
//# sourceMappingURL=innate_abilities.js.map