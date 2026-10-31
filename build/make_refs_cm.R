args <- commandArgs(trailingOnly = TRUE); src <- args[1]; out <- args[2]
suppressPackageStartupMessages({ library(bibliometrix) }); `%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
sys.source(file.path(src, "R", "biblio.R"), envir = globalenv())
data(management, package = "bibliometrixData"); M <- normalize_M(management); set.seed(1)
cm <- couplingMap(M, analysis = "documents", field = "CR", n = 250, impact.measure = "local", minfreq = 3, size = .5, n.labels = 2, repel = TRUE)
cr <- cm$net$cluster_res
jsonlite::write_json(list(membership = setNames(as.list(cm$net$cluster_obj$membership), igraph::V(cm$net$graph)$name), colors = bibliometrix:::colorlist(), nodes = igraph::V(cm$net$graph)$name), file.path(out, "management", "coupling.json"), auto_unbox = TRUE)
