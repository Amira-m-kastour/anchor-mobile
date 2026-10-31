# Exports the desktop app's shared content to JSON for the mobile app (run from the desktop source folder)
args <- commandArgs(trailingOnly = TRUE); src <- args[1]; out <- args[2]
`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
user_dir <- function() tempdir()
for (f in c("phases.R", "lessons.R", "ai.R", "prereq.R", "finder.R")) sys.source(file.path(src, "R", f), envir = globalenv())
nv <- function(x) lapply(seq_along(x), function(i) list(label = names(x)[i], value = unname(x[[i]])))
ph <- lapply(PHASES, function(p) { p$questions <- lapply(p$questions, function(q) { q$choices <- if (is.null(q$choices)) NULL else as.list(q$choices); q }); p$controls <- as.list(p$controls); p$checks <- as.list(p$checks); p })
x <- list(phases = unname(ph), controls = as.list(CONTROLS), setup = lapply(SETUP_QUESTIONS, function(q) { if (!is.null(q$choices)) q$choices <- as.list(q$choices); q }),
  question_tail = QUESTION_TAIL, ai_modes = nv(AI_MODES), lessons_asof = LESSONS_ASOF, refs = REFS,
  lessons = lapply(LESSONS, function(l) { l$lessons <- as.list(l$lessons); l$refs <- as.list(l$refs); l }),
  db_catalog = lapply(seq_len(nrow(DB_CATALOG)), function(i) as.list(DB_CATALOG[i, ])), institution_dbs = INSTITUTION_DBS,
  skills = nv(PREREQ_SKILLS), rules = nv(PREREQ_RULES), output_licences = nv(OUTPUT_LICENCES), code_licences = nv(CODE_LICENCES), ethics = nv(ETHICS),
  cite_styles = nv(CITE_STYLES), find_sorts = nv(FIND_SORTS), find_types = nv(FIND_TYPES), find_criteria = nv(FIND_CRITERIA),
  version_label = as.list(VERSION_LABEL), version_to_start = as.list(VERSION_TO_START))
writeLines(paste0("window.ANCHOR_CONTENT = ", jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", pretty = FALSE), ";"), out, useBytes = TRUE)
