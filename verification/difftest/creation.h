/* Creation observations. Algorithms remain in the linked recorder sources. */
#include <sys/wait.h>
#include <unistd.h>

static void creation_setup(void);
static void creation_objects(struct obj *);
static void creation_rng(void);

static void run_creation_case(void)
{
    struct obj *obj = NULL;
    struct permonst *species = NULL;
    struct monst *monster = NULL;
    int target = number(0, "target", 6, 11), result = 0, i;
    creation_setup();
    switch (target) {
    case 6:
        obj = mksobj(number(0, "otyp", MAXOCLASSES, NUM_OBJECTS - 1),
                     number(0, "init", 0, 1), number(0, "artif", 0, 1));
        break;
    case 7:
        obj = mkobj(number(0, "oclass", -SPBOOK_CLASS, VENOM_CLASS),
                    number(0, "artif", 0, 1));
        break;
    case 8:
        result = rnd_class(number(0, "first", MAXOCLASSES, NUM_OBJECTS - 1),
                           number(0, "last", MAXOCLASSES, NUM_OBJECTS - 1));
        break;
    case 9: species = rndmonst(); result = species ? monsndx(species) : NON_PM; break;
    case 10:
        species = mkclass_aligned(number(0, "mclass", 1, MAXMCLASSES - 1),
                                  number(0, "spc", 0, 65535),
                                  number(0, "alignment", A_NONE, A_LAWFUL));
        result = species ? monsndx(species) : NON_PM;
        break;
    case 11:
        monster = makemon(&mons[number(0, "mnum", 0, NUMMONS - 1)], 11, 10,
                         MM_NOGRP | MM_ANGRY | MM_NOMSG | MM_NONAME | MM_NOTAIL);
        result = monster ? monster->mnum : NON_PM;
        break;
    }
    printf("{\"result\":%d,\"objects\":", result);
    creation_objects(obj ? obj : monster ? monster->minvent : NULL);
    printf(",\"difficulty\":%d,\"nextIdent\":%u,\"vitals\":[",
           level_difficulty(), svc.context.ident);
    for (i = 0; i < NUMMONS; i++)
        printf("%s[%d,%d]", i ? "," : "", svm.mvitals[i].mvflags, svm.mvitals[i].born);
    printf("]");
    creation_rng();
}

static void creation_setup(void)
{
    int lvl = member(0, "level"), i, x, y, v;
    int place = number(lvl, "place", 0, 8);
    decl_globals_init();
    objects_globals_init();
    monst_globals_init();
    memset(&u, 0, sizeof u);
    memset(levl, 0, sizeof levl);
    gu.urole = roles[0]; gu.urace = races[0];
    u.umonster = u.umonnum = gu.urole.mnum;
    gy.youmonst.data = &mons[u.umonnum];
    for (i = 0; i < A_MAX; i++) ABASE(i) = AMAX(i) = 12;
    u.ulevel = number(lvl, "heroLevel", 1, 30);
    u.ualign.type = A_NEUTRAL; u.ualign.record = 10;
    u.ux = u.uy = 10; u.uhp = u.uhpmax = 40;
    HProtection_from_shape_changers = FROMOUTSIDE;
    set_uasmon();
    /* Distinct branch identities keep ordinary levels out of the quest,
       endgame, Mines and tower predicates. Endgame difficulty uses Sanctum. */
    quest_dnum = 1; mines_dnum = 2; sokoban_dnum = 3;
    tower_dnum = 4;
    astral_level.dnum = earth_level.dnum = air_level.dnum = 5;
    fire_level.dnum = water_level.dnum = 5;
    astral_level.dlevel = 1; water_level.dlevel = 2;
    fire_level.dlevel = 3; air_level.dlevel = 4; earth_level.dlevel = 5;
    sanctum_level.dnum = 0; sanctum_level.dlevel = number(lvl, "depth", 1, 50);
    u.uz.dnum = place >= 4 ? 5 : place == 3 ? 2 : 0;
    u.uz.dlevel = place >= 4 ? 9 - place : number(lvl, "depth", 1, 50);
    rogue_level.dnum = place == 2 ? u.uz.dnum : 6;
    rogue_level.dlevel = u.uz.dlevel;
    svn.n_dgns = 7;
    for (i = 0; i < 7; i++) {
        svd.dungeons[i].depth_start = 1;
        svd.dungeons[i].num_dunlevs = 50;
        svd.dungeons[i].entry_lev = 1;
        svd.dungeons[i].ledger_start = i * 50;
    }
    svd.dungeons[u.uz.dnum].flags.hellish = place == 1;
    svd.dungeons[u.uz.dnum].flags.align =
        Align2amask(number(lvl, "alignment", A_NONE, A_LAWFUL));
    svm.moves = number(lvl, "moves", 0, 100000);
    gi.in_mklev = number(lvl, "inMklev", 0, 1);
    svl.level.flags.rndmongen = 1;
    svl.level.flags.temperature = number(lvl, "temperature", -1, 1);
    svl.level.flags.noteleport = number(lvl, "noTeleport", 0, 1);
    svl.level.flags.stasis_until = number(lvl, "stasisUntil", 0, 100100);
    svc.context.current_fruit = 1;
    svc.context.ident = 2;
    for (x = 7; x <= 16; x++)
        for (y = 6; y <= 14; y++) {
            levl[x][y].typ = ROOM;
            levl[x][y].lit = number(lvl, "lit", 0, 1);
        }
    for (i = 0; i < NUMMONS; i++)
        svm.mvitals[i].mvflags = mons[i].geno & G_NOCORPSE;
    v = member(0, "vitals");
    for (i = v + 1; i < tokens[v].next; i = tokens[i].next) {
        int mnum = number(i, "mnum", 0, NUMMONS - 1);
        svm.mvitals[mnum].mvflags |= number(i, "flags", 0, G_GONE);
        svm.mvitals[mnum].born = number(i, "born", 0, 255);
    }
    vision_init();
    vision_reset();
    streams[0] = &rnglist[CORE].rng_state;
    streams[1] = &rnglist[DISP].rng_state;
    init_isaac64(999UL, rn2); init_isaac64(999UL, rn2_on_display_rng);
    init_objects();
    oinit();
    init_artifacts();
    init_isaac64(number(0, "seed", 0, 2147483647), rn2);
    init_isaac64(number(0, "seed", 0, 2147483647), rn2_on_display_rng);
    for (i = number(0, "position", 0, 4096); i; i--) (void) rn2(1);
    positions[0] = positions[1] = 0;
    rng_call_count = 0; rng_logfile = tmpfile();
    if (!rng_logfile) reject_input("cannot create RNG log");
}

static void creation_number(const char *name, long value)
{
    printf(",\"%s\":%ld", name, value);
}

static void creation_objects(struct obj *obj)
{
    const char *timer_names[NUM_TIME_FUNCS] = {
        [ROT_ORGANIC] = "rot-organic", [ROT_CORPSE] = "rot-corpse",
        [REVIVE_MON] = "revive-mon", [ZOMBIFY_MON] = "zombify-mon",
        [BURN_OBJECT] = "burn-object", [HATCH_EGG] = "hatch-egg",
        [FIG_TRANSFORM] = "fig-transform", [SHRINK_GLOB] = "shrink-glob",
    };
    printf("[");
    for (; obj; obj = obj->nobj) {
        timer_element *timer;
        if (obj->where != OBJ_FREE && obj->where != OBJ_MINVENT
            && obj->where != OBJ_CONTAINED) reject_input("unexpected creation ownership");
        int count = 0;
        boolean body = obj->otyp == CORPSE || obj->otyp == STATUE
            || obj->otyp == FIGURINE || obj->otyp == TIN || obj->otyp == EGG
            || Is_pudding(obj);
        printf("{\"otyp\":%d", obj->otyp);
#define OBJECT_FIELD(name) creation_number(#name, obj->name)
        OBJECT_FIELD(o_id);
        OBJECT_FIELD(oclass);
        OBJECT_FIELD(quan);
        OBJECT_FIELD(owt);
        creation_number("corpsenm", body ? obj->corpsenm : NON_PM);
        OBJECT_FIELD(spe);
        OBJECT_FIELD(age);
        OBJECT_FIELD(blessed);
        OBJECT_FIELD(cursed);
        OBJECT_FIELD(oeroded);
        OBJECT_FIELD(oeroded2);
        OBJECT_FIELD(oerodeproof);
        creation_number("opoisoned", obj->oclass == WEAPON_CLASS ? obj->opoisoned : 0);
        OBJECT_FIELD(greased);
        OBJECT_FIELD(known);
        OBJECT_FIELD(dknown);
        OBJECT_FIELD(bknown);
        OBJECT_FIELD(rknown);
        OBJECT_FIELD(tknown);
        OBJECT_FIELD(olocked);
        creation_number("otrapped", obj->oclass == WEAPON_CLASS ? 0 : obj->otrapped);
        OBJECT_FIELD(recharged);
        OBJECT_FIELD(lamplit);
        OBJECT_FIELD(globby);
        OBJECT_FIELD(oeaten);
        OBJECT_FIELD(oartifact);
#undef OBJECT_FIELD
        creation_number("wornMask", obj->owornmask);
        printf(",\"where\":\"%s\"", obj->where == OBJ_CONTAINED ? "contained"
               : obj->where == OBJ_MINVENT ? "minvent" : "free");
        creation_number("novelidx", obj->otyp == SPE_NOVEL ? obj->novelidx : -1);
        printf(",\"timers\":[");
        for (timer = gt.timer_base; timer; timer = timer->next)
            if (timer->kind == TIMER_OBJECT && timer->arg.a_obj == obj) {
                if (timer->func_index < 0 || timer->func_index >= NUM_TIME_FUNCS
                    || !timer_names[timer->func_index]) abort();
                printf("%s{\"kind\":\"%s\",\"deadline\":%ld}", count++ ? "," : "",
                       timer_names[timer->func_index], timer->timeout);
            }
        printf("],\"containerType\":%d,\"carrierSpecies\":%d,\"aliases\":{"
               "\"orotten\":%d,\"odiluted\":%d,\"norevive\":%d,"
               "\"on_ice\":%d,\"degraded_horn\":%d,\"leashmon\":%d,"
               "\"fromsink\":%d,\"next_boulder\":%d,\"spestudied\":%d},\"contents\":",
               obj->where == OBJ_CONTAINED ? obj->ocontainer->otyp : -1,
               obj->where == OBJ_MINVENT ? obj->ocarry->mnum : -1,
               obj->oclass == FOOD_CLASS ? obj->orotten : 0,
               obj->oclass == POTION_CLASS ? obj->odiluted : 0,
               obj->otyp == CORPSE ? obj->norevive : 0,
               obj->otyp == CORPSE ? obj->on_ice : 0,
               obj->otyp == UNICORN_HORN ? obj->degraded_horn : 0,
               obj->otyp == LEASH ? obj->leashmon : 0,
               obj->oclass == POTION_CLASS ? obj->fromsink : 0,
               obj->otyp == BOULDER ? obj->next_boulder : 0,
               obj->oclass == SPBOOK_CLASS ? obj->spestudied : 0);
        creation_objects(obj->cobj);
        printf("}%s", obj->nobj ? "," : "");
    }
    printf("]");
}

static void creation_rng(void)
{
    char line[1024], operation[256];
    int count = 0;
    printf(",\"rng\":{\"core\":%u,\"display\":%u,\"log\":[", positions[0], positions[1]);
    rewind(rng_logfile);
    while (fgets(line, sizeof line, rng_logfile)) {
        char *start = strchr(line, ' ');
        int j = 0;
        if (!start) abort();
        for (start++; *start && *start != '@' && *start != '\n'; start++)
            if (*start != ' ') {
                if (j >= (int) sizeof operation - 1) abort();
                operation[j++] = *start;
            }
        operation[j] = '\0';
        printf("%s\"%s\"", count++ ? "," : "", operation);
    }
    printf("]}}\n");
    fclose(rng_logfile);
}
