args <- commandArgs(trailingOnly = TRUE); src <- args[1]; out <- args[2]
suppressPackageStartupMessages({ library(bibliometrix) }); `%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
sys.source(file.path(src, "R", "biblio.R"), envir = globalenv())
one <- function(name, M) { M <- normalize_M(M); set.seed(1)
  tm <- thematicMap(M, field = "DE", n = 250, minfreq = 5, stemming = FALSE, size = .5, n.labels = 3, repel = TRUE)
  cr <- tm$net$cluster_res
  NM <- biblioNetwork(M, analysis = "co-occurrences", network = "author_keywords", sep = ";")
  g <- igraph::graph.adjacency(NM, mode = "undirected", weighted = NULL); deg <- igraph::degree(g)
  jsonlite::write_json(list(membership = setNames(as.list(cr$cluster), cr$vertex), clusters = as.data.frame(tm$clusters)[, c("name","freq","centrality","density","rcentrality","rdensity")],
    walktrap_modularity = igraph::modularity(tm$net$graph, cr$cluster[match(igraph::V(tm$net$graph)$name, cr$vertex)]), deg_top = head(sort(deg, decreasing = TRUE), 5)),
    file.path(out, name, "thematic.json"), auto_unbox = TRUE, digits = NA) }
data(management, package = "bibliometrixData"); one("management", management)
fx <- Sys.getenv("FIX")
for (s in list(c("scopus", "scopus_sample.csv", "scopus", "csv"), c("wos", "wos_sample.txt", "wos", "plaintext"))) one(s[1], suppressMessages(suppressWarnings(convert2df(file.path(fx, s[2]), dbsource = s[3], format = s[4]))))
