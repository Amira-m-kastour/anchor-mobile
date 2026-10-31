# Reference outputs from the desktop app's analyses (bibliometrix 4.3.1) for the mobile port's tests
args <- commandArgs(trailingOnly = TRUE); src <- args[1]; out <- args[2]
suppressPackageStartupMessages({ library(bibliometrix); library(shiny) })
`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
`%|%` <- function(a, b) ifelse(is.na(a), b, a)
for (f in c("biblio.R")) sys.source(file.path(src, "R", f), envir = globalenv())
dump_set <- function(name, M) {
  dir.create(file.path(out, name), showWarnings = FALSE, recursive = TRUE)
  M <- normalize_M(M); R <- biblioAnalysis(M, sep = ";")
  keep <- intersect(c("AU","TI","SO","JI","J9","PY","TC","DE","ID","CR","C1","RP","DI","DT","LA","DB","AB","SR","SR_FULL","AU_UN","AU_CO","AU1_CO","C3","VL","BP","EP","PU"), names(M))
  jsonlite::write_json(as.data.frame(M)[, keep], file.path(out, name, "M.json"), na = "null", digits = NA)
  ids <- names(ANALYSES); res <- list()
  for (id in ids) {
    t0 <- Sys.time()
    r <- tryCatch({ set.seed(1); suppressWarnings(run_analysis(id, M, R, list())) }, error = function(e) list(error = conditionMessage(e)))
    tab <- r$table; if (is.data.frame(tab) || is.matrix(tab)) tab <- as.data.frame(tab)
    res[[id]] <- list(error = r$error %||% "", note = r$note %||% "", table = tab, secs = as.numeric(difftime(Sys.time(), t0, units = "secs")))
    cat(sprintf("%-22s %6.1fs %s\n", id, res[[id]]$secs, substr(r$error %||% "", 1, 80)))
  }
  jsonlite::write_json(res, file.path(out, name, "results.json"), na = "null", digits = NA, auto_unbox = TRUE, dataframe = "columns")
  # extra raw pieces for the port
  extra <- list(main = summary(R, k = 10, pause = FALSE, verbose = FALSE)$MainInformationDF,
    AU_CO = metaTagExtraction(M, "AU_CO")$AU_CO, AU1_CO = metaTagExtraction(M, "AU1_CO", sep = ";")$AU1_CO,
    AU_UN = metaTagExtraction(M, "AU_UN", sep = ";")$AU_UN, CR_SO = if ("CR" %in% names(M)) metaTagExtraction(M, "CR_SO", sep = ";")$CR_SO else NULL)
  jsonlite::write_json(extra, file.path(out, name, "extra.json"), na = "null", digits = NA, auto_unbox = TRUE, dataframe = "columns")
}
data(management, package = "bibliometrixData"); dump_set("management", management)
fx <- file.path(Sys.getenv("FIX"))
for (s in list(c("scopus", "scopus_sample.csv", "scopus", "csv"), c("wos", "wos_sample.txt", "wos", "plaintext"))) {
  M <- suppressMessages(suppressWarnings(convert2df(file.path(fx, s[2]), dbsource = s[3], format = s[4])))
  dump_set(s[1], M)
}
data(countries, package = "bibliometrix"); jsonlite::write_json(countries, file.path(out, "countries.json"), dataframe = "columns")
e <- new.env(); data(stopwords, package = "bibliometrix", envir = e); if (exists("stopwords", e)) jsonlite::write_json(e$stopwords, file.path(out, "stopwords.json"))
