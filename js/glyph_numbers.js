import { AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, AM_SANCTUM, MAXEXPCHARS, MAXTCHARS, WARNCOUNT, } from './const.js';
import { MONSTER_COLOR } from './monster_data.js';
import { OBJECT_COLOR } from './object_data.js';
// Pinned defsym.h indices. These select glyphs, independently of tty symbols.
export var CmapSymbol;
(function (CmapSymbol) {
    CmapSymbol[CmapSymbol["stone"] = 0] = "stone";
    CmapSymbol[CmapSymbol["vwall"] = 1] = "vwall";
    CmapSymbol[CmapSymbol["hwall"] = 2] = "hwall";
    CmapSymbol[CmapSymbol["tlcorn"] = 3] = "tlcorn";
    CmapSymbol[CmapSymbol["trcorn"] = 4] = "trcorn";
    CmapSymbol[CmapSymbol["blcorn"] = 5] = "blcorn";
    CmapSymbol[CmapSymbol["brcorn"] = 6] = "brcorn";
    CmapSymbol[CmapSymbol["crwall"] = 7] = "crwall";
    CmapSymbol[CmapSymbol["tuwall"] = 8] = "tuwall";
    CmapSymbol[CmapSymbol["tdwall"] = 9] = "tdwall";
    CmapSymbol[CmapSymbol["tlwall"] = 10] = "tlwall";
    CmapSymbol[CmapSymbol["trwall"] = 11] = "trwall";
    CmapSymbol[CmapSymbol["ndoor"] = 12] = "ndoor";
    CmapSymbol[CmapSymbol["vodoor"] = 13] = "vodoor";
    CmapSymbol[CmapSymbol["hodoor"] = 14] = "hodoor";
    CmapSymbol[CmapSymbol["vcdoor"] = 15] = "vcdoor";
    CmapSymbol[CmapSymbol["hcdoor"] = 16] = "hcdoor";
    CmapSymbol[CmapSymbol["bars"] = 17] = "bars";
    CmapSymbol[CmapSymbol["tree"] = 18] = "tree";
    CmapSymbol[CmapSymbol["room"] = 19] = "room";
    CmapSymbol[CmapSymbol["darkroom"] = 20] = "darkroom";
    CmapSymbol[CmapSymbol["engroom"] = 21] = "engroom";
    CmapSymbol[CmapSymbol["corr"] = 22] = "corr";
    CmapSymbol[CmapSymbol["litcorr"] = 23] = "litcorr";
    CmapSymbol[CmapSymbol["engrcorr"] = 24] = "engrcorr";
    CmapSymbol[CmapSymbol["upstair"] = 25] = "upstair";
    CmapSymbol[CmapSymbol["dnstair"] = 26] = "dnstair";
    CmapSymbol[CmapSymbol["upladder"] = 27] = "upladder";
    CmapSymbol[CmapSymbol["dnladder"] = 28] = "dnladder";
    CmapSymbol[CmapSymbol["brupstair"] = 29] = "brupstair";
    CmapSymbol[CmapSymbol["brdnstair"] = 30] = "brdnstair";
    CmapSymbol[CmapSymbol["brupladder"] = 31] = "brupladder";
    CmapSymbol[CmapSymbol["brdnladder"] = 32] = "brdnladder";
    CmapSymbol[CmapSymbol["altar"] = 33] = "altar";
    CmapSymbol[CmapSymbol["grave"] = 34] = "grave";
    CmapSymbol[CmapSymbol["throne"] = 35] = "throne";
    CmapSymbol[CmapSymbol["sink"] = 36] = "sink";
    CmapSymbol[CmapSymbol["fountain"] = 37] = "fountain";
    CmapSymbol[CmapSymbol["pool"] = 38] = "pool";
    CmapSymbol[CmapSymbol["ice"] = 39] = "ice";
    CmapSymbol[CmapSymbol["lava"] = 40] = "lava";
    CmapSymbol[CmapSymbol["lavawall"] = 41] = "lavawall";
    CmapSymbol[CmapSymbol["vodbridge"] = 42] = "vodbridge";
    CmapSymbol[CmapSymbol["hodbridge"] = 43] = "hodbridge";
    CmapSymbol[CmapSymbol["vcdbridge"] = 44] = "vcdbridge";
    CmapSymbol[CmapSymbol["hcdbridge"] = 45] = "hcdbridge";
    CmapSymbol[CmapSymbol["air"] = 46] = "air";
    CmapSymbol[CmapSymbol["cloud"] = 47] = "cloud";
    CmapSymbol[CmapSymbol["water"] = 48] = "water";
    CmapSymbol[CmapSymbol["arrowTrap"] = 49] = "arrowTrap";
    CmapSymbol[CmapSymbol["digbeam"] = 78] = "digbeam";
    CmapSymbol[CmapSymbol["boomleft"] = 80] = "boomleft";
    CmapSymbol[CmapSymbol["boomright"] = 81] = "boomright";
    CmapSymbol[CmapSymbol["poisoncloud"] = 86] = "poisoncloud";
    CmapSymbol[CmapSymbol["goodpos"] = 87] = "goodpos";
})(CmapSymbol || (CmapSymbol = {}));
const NUMMONS = MONSTER_COLOR.length;
const NUM_OBJECTS = OBJECT_COLOR.length;
const WALL_GLYPHS = CmapSymbol.trwall - CmapSymbol.vwall + 1;
// display.h:enum glyph_offsets. Keep every range in native order.
export var GlyphOffset;
(function (GlyphOffset) {
    GlyphOffset[GlyphOffset["monMale"] = 0] = "monMale";
    GlyphOffset[GlyphOffset["monFemale"] = NUMMONS + GlyphOffset.monMale] = "monFemale";
    GlyphOffset[GlyphOffset["petMale"] = NUMMONS + GlyphOffset.monFemale] = "petMale";
    GlyphOffset[GlyphOffset["petFemale"] = NUMMONS + GlyphOffset.petMale] = "petFemale";
    GlyphOffset[GlyphOffset["invisible"] = NUMMONS + GlyphOffset.petFemale] = "invisible";
    GlyphOffset[GlyphOffset["detectMale"] = 1 + GlyphOffset.invisible] = "detectMale";
    GlyphOffset[GlyphOffset["detectFemale"] = NUMMONS + GlyphOffset.detectMale] = "detectFemale";
    GlyphOffset[GlyphOffset["body"] = NUMMONS + GlyphOffset.detectFemale] = "body";
    GlyphOffset[GlyphOffset["riddenMale"] = NUMMONS + GlyphOffset.body] = "riddenMale";
    GlyphOffset[GlyphOffset["riddenFemale"] = NUMMONS + GlyphOffset.riddenMale] = "riddenFemale";
    GlyphOffset[GlyphOffset["object"] = NUMMONS + GlyphOffset.riddenFemale] = "object";
    GlyphOffset[GlyphOffset["cmapStone"] = NUM_OBJECTS + GlyphOffset.object] = "cmapStone";
    GlyphOffset[GlyphOffset["cmapMain"] = 1 + GlyphOffset.cmapStone] = "cmapMain";
    GlyphOffset[GlyphOffset["cmapMines"] = WALL_GLYPHS + GlyphOffset.cmapMain] = "cmapMines";
    GlyphOffset[GlyphOffset["cmapGehennom"] = WALL_GLYPHS + GlyphOffset.cmapMines] = "cmapGehennom";
    GlyphOffset[GlyphOffset["cmapKnox"] = WALL_GLYPHS + GlyphOffset.cmapGehennom] = "cmapKnox";
    GlyphOffset[GlyphOffset["cmapSokoban"] = WALL_GLYPHS + GlyphOffset.cmapKnox] = "cmapSokoban";
    GlyphOffset[GlyphOffset["cmapA"] = WALL_GLYPHS + GlyphOffset.cmapSokoban] = "cmapA";
    GlyphOffset[GlyphOffset["altar"] = CmapSymbol.brdnladder - CmapSymbol.ndoor + 1 + GlyphOffset.cmapA] = "altar";
    GlyphOffset[GlyphOffset["cmapB"] = 5 + GlyphOffset.altar] = "cmapB";
    GlyphOffset[GlyphOffset["zap"] = CmapSymbol.arrowTrap + MAXTCHARS - CmapSymbol.grave + GlyphOffset.cmapB] = "zap";
    GlyphOffset[GlyphOffset["cmapC"] = (8 << 2) + GlyphOffset.zap] = "cmapC";
    GlyphOffset[GlyphOffset["swallow"] = CmapSymbol.goodpos - CmapSymbol.digbeam + 1 + GlyphOffset.cmapC] = "swallow";
    GlyphOffset[GlyphOffset["explodeDark"] = (NUMMONS << 3) + GlyphOffset.swallow] = "explodeDark";
    GlyphOffset[GlyphOffset["explodeNoxious"] = MAXEXPCHARS + GlyphOffset.explodeDark] = "explodeNoxious";
    GlyphOffset[GlyphOffset["explodeMuddy"] = MAXEXPCHARS + GlyphOffset.explodeNoxious] = "explodeMuddy";
    GlyphOffset[GlyphOffset["explodeWet"] = MAXEXPCHARS + GlyphOffset.explodeMuddy] = "explodeWet";
    GlyphOffset[GlyphOffset["explodeMagical"] = MAXEXPCHARS + GlyphOffset.explodeWet] = "explodeMagical";
    GlyphOffset[GlyphOffset["explodeFiery"] = MAXEXPCHARS + GlyphOffset.explodeMagical] = "explodeFiery";
    GlyphOffset[GlyphOffset["explodeFrosty"] = MAXEXPCHARS + GlyphOffset.explodeFiery] = "explodeFrosty";
    GlyphOffset[GlyphOffset["warning"] = MAXEXPCHARS + GlyphOffset.explodeFrosty] = "warning";
    GlyphOffset[GlyphOffset["statueMale"] = WARNCOUNT + GlyphOffset.warning] = "statueMale";
    GlyphOffset[GlyphOffset["statueFemale"] = NUMMONS + GlyphOffset.statueMale] = "statueFemale";
    GlyphOffset[GlyphOffset["objectPiletop"] = NUMMONS + GlyphOffset.statueFemale] = "objectPiletop";
    GlyphOffset[GlyphOffset["bodyPiletop"] = NUM_OBJECTS + GlyphOffset.objectPiletop] = "bodyPiletop";
    GlyphOffset[GlyphOffset["statueMalePiletop"] = NUMMONS + GlyphOffset.bodyPiletop] = "statueMalePiletop";
    GlyphOffset[GlyphOffset["statueFemalePiletop"] = NUMMONS + GlyphOffset.statueMalePiletop] = "statueFemalePiletop";
    GlyphOffset[GlyphOffset["unexplored"] = NUMMONS + GlyphOffset.statueFemalePiletop] = "unexplored";
    GlyphOffset[GlyphOffset["nothing"] = GlyphOffset.unexplored + 1] = "nothing";
    GlyphOffset[GlyphOffset["max"] = GlyphOffset.nothing + 1] = "max";
})(GlyphOffset || (GlyphOffset = {}));
// display.h:cmap_to_glyph(), with the caller selecting its branch's wall range.
export function cmapToGlyph(symbol, wallOffset = GlyphOffset.cmapMain) {
    if (symbol === CmapSymbol.stone)
        return GlyphOffset.cmapStone;
    if (symbol <= CmapSymbol.trwall)
        return symbol - CmapSymbol.vwall + wallOffset;
    if (symbol < CmapSymbol.altar)
        return symbol - CmapSymbol.ndoor + GlyphOffset.cmapA;
    if (symbol === CmapSymbol.altar)
        return altarToGlyph(AM_NEUTRAL);
    if (symbol < CmapSymbol.arrowTrap + MAXTCHARS)
        return symbol - CmapSymbol.grave + GlyphOffset.cmapB;
    if (symbol <= CmapSymbol.goodpos)
        return symbol - CmapSymbol.digbeam + GlyphOffset.cmapC;
    return GlyphOffset.max;
}
// Shrine status does not select another glyph; sanctum status does.
export function altarToGlyph(mask) {
    if (mask & AM_SANCTUM)
        return GlyphOffset.altar + 4;
    const alignment = mask & AM_MASK;
    if (alignment === AM_LAWFUL)
        return GlyphOffset.altar + 3;
    if (alignment === AM_NEUTRAL)
        return GlyphOffset.altar + 2;
    if (alignment === AM_CHAOTIC)
        return GlyphOffset.altar + 1;
    return GlyphOffset.altar;
}
//# sourceMappingURL=glyph_numbers.js.map