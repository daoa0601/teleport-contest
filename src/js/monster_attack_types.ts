// Generated from nethack-c/upstream/include/monattk.h.
// Run npm run generate:monster-attacks after updating the pinned C source.

export const AT_ANY = -1;
export const AT_NONE = 0;
export const AT_CLAW = 1;
export const AT_BITE = 2;
export const AT_KICK = 3;
export const AT_BUTT = 4;
export const AT_TUCH = 5;
export const AT_STNG = 6;
export const AT_HUGS = 7;
export const AT_SPIT = 10;
export const AT_ENGL = 11;
export const AT_BREA = 12;
export const AT_EXPL = 13;
export const AT_BOOM = 14;
export const AT_GAZE = 15;
export const AT_TENT = 16;
export const AT_WEAP = 254;
export const AT_MAGC = 255;

export const AD_ANY = -1;
export const AD_PHYS = 0;
export const AD_MAGM = 1;
export const AD_FIRE = 2;
export const AD_COLD = 3;
export const AD_SLEE = 4;
export const AD_DISN = 5;
export const AD_ELEC = 6;
export const AD_DRST = 7;
export const AD_ACID = 8;
export const AD_SPC1 = 9;
export const AD_SPC2 = 10;
export const AD_BLND = 11;
export const AD_STUN = 12;
export const AD_SLOW = 13;
export const AD_PLYS = 14;
export const AD_DRLI = 15;
export const AD_DREN = 16;
export const AD_LEGS = 17;
export const AD_STON = 18;
export const AD_STCK = 19;
export const AD_SGLD = 20;
export const AD_SITM = 21;
export const AD_SEDU = 22;
export const AD_TLPT = 23;
export const AD_RUST = 24;
export const AD_CONF = 25;
export const AD_DGST = 26;
export const AD_HEAL = 27;
export const AD_WRAP = 28;
export const AD_WERE = 29;
export const AD_DRDX = 30;
export const AD_DRCO = 31;
export const AD_DRIN = 32;
export const AD_DISE = 33;
export const AD_DCAY = 34;
export const AD_SSEX = 35;
export const AD_HALU = 36;
export const AD_DETH = 37;
export const AD_PEST = 38;
export const AD_FAMN = 39;
export const AD_SLIM = 40;
export const AD_ENCH = 41;
export const AD_CORR = 42;
export const AD_POLY = 43;
export const AD_CLRC = 240;
export const AD_SPEL = 241;
export const AD_RBRE = 242;
export const AD_SAMU = 252;
export const AD_CURS = 253;

export type AttackMethod =
    typeof AT_NONE
    | typeof AT_CLAW
    | typeof AT_BITE
    | typeof AT_KICK
    | typeof AT_BUTT
    | typeof AT_TUCH
    | typeof AT_STNG
    | typeof AT_HUGS
    | typeof AT_SPIT
    | typeof AT_ENGL
    | typeof AT_BREA
    | typeof AT_EXPL
    | typeof AT_BOOM
    | typeof AT_GAZE
    | typeof AT_TENT
    | typeof AT_WEAP
    | typeof AT_MAGC;

export type DamageType =
    typeof AD_PHYS
    | typeof AD_MAGM
    | typeof AD_FIRE
    | typeof AD_COLD
    | typeof AD_SLEE
    | typeof AD_DISN
    | typeof AD_ELEC
    | typeof AD_DRST
    | typeof AD_ACID
    | typeof AD_SPC1
    | typeof AD_SPC2
    | typeof AD_BLND
    | typeof AD_STUN
    | typeof AD_SLOW
    | typeof AD_PLYS
    | typeof AD_DRLI
    | typeof AD_DREN
    | typeof AD_LEGS
    | typeof AD_STON
    | typeof AD_STCK
    | typeof AD_SGLD
    | typeof AD_SITM
    | typeof AD_SEDU
    | typeof AD_TLPT
    | typeof AD_RUST
    | typeof AD_CONF
    | typeof AD_DGST
    | typeof AD_HEAL
    | typeof AD_WRAP
    | typeof AD_WERE
    | typeof AD_DRDX
    | typeof AD_DRCO
    | typeof AD_DRIN
    | typeof AD_DISE
    | typeof AD_DCAY
    | typeof AD_SSEX
    | typeof AD_HALU
    | typeof AD_DETH
    | typeof AD_PEST
    | typeof AD_FAMN
    | typeof AD_SLIM
    | typeof AD_ENCH
    | typeof AD_CORR
    | typeof AD_POLY
    | typeof AD_CLRC
    | typeof AD_SPEL
    | typeof AD_RBRE
    | typeof AD_SAMU
    | typeof AD_CURS;
