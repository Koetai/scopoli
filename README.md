# Scopoli — learn SPARQL through biomedical problems

A [Koetai](https://koetai.github.io/) product. Scopoli is a [Rosalind](https://rosalind.info)-style problem site for SPARQL: 48 problems in seven chapters, each one a small biomedical task checked against a live endpoint.

**Live:** https://koetai.github.io/scopoli/

| Chapter | What you do |
|---|---|
| **Python village** | Set up Python with rdflib, parse OFCO, run SPARQL in memory, join XML to RDF |
| **Your endpoint** | Learn the SPARQL protocol and run your own store: Oxigraph, Jena Fuseki, QLever, Virtuoso, GraphDB, Blazegraph or Comunica (you pick one) |
| **Rare disease data** | Find, convert, clean and load Orphanet's ORDO, HOOM and OFCO plus HPO and the functional-consequence XML, then integrate them |
| **Rare disease queries** | Cross-references, genes, `part_of` hierarchies, phenotypes, functional consequences, MINUS vs NOT EXISTS, federation to Wikidata, all on your own endpoint |
| **Wikidata** | Core SPARQL on genes, drugs and diseases |
| **UniProt & SIB** | UniProt, Gene Ontology, federation with Rhea, Wikidata → UniProt |
| **RDF Portal** | MeSH, ChEMBL and ClinVar on DBCLS's RDF Portal |

## How answers are checked

- **Query problems:** on *Submit*, the browser runs the learner's query and the problem's reference `solution` against the same endpoint. That's the public endpoint, or the learner's own for the rare-disease chapters. It then compares the sets of values in the `check` columns. Local problems first run small probe queries, so a store with missing data gets a "load X first" message instead of a false pass.
- **Python problems** have a fixed `answer`. Input files are pinned, for example OFCO at a specific commit.
- **Endpoint problems** pass when the browser can query the learner's endpoint, which needs CORS.
- **Guides** are marked done by the learner.

Progress is kept in `localStorage`.

## Rare-disease dataset

[`prepare/build.sh`](prepare/build.sh) builds the local dataset (5.4 M triples):

- **ORDO 4.9**, **HPO** and **OFCO**: converted from RDF/XML to N-Triples.
- **HOOM 2.6**: published as OWL/XML, so it's converted with ROBOT. Four IRIs containing `[` or `]` get percent-encoded.
- **Orphanet functional consequences**: XML, turned into RDF by [`prepare/fc_to_rdf.py`](prepare/fc_to_rdf.py). It links ORDO disorders to OFCO terms through OFCO's `hasORPHANETDBInternalReference`.

[`prepare/cors_proxy.py`](prepare/cors_proxy.py) adds CORS headers in front of endpoints that lack them, such as Blazegraph.

Every local reference query has been run on Oxigraph 0.5.12, Fuseki 6.2.0, QLever and Virtuoso 7.2.17 with identical results. The subset that doesn't need HOOM was also run on Comunica 5.4.1.

Orphanet data © INSERM, CC BY 4.0, via [Orphadata](https://sciences.orphadata.com/). OFCO from [Orphanet/ofco-ontology](https://github.com/Orphanet/ofco-ontology). HPO from [hpo.jax.org](https://hpo.jax.org/).

## Adding a problem

Append an object to `PROBLEMS` in [`problems.js`](problems.js), or to `LOCAL_PROBLEMS` in [`local-problems.js`](local-problems.js). Each needs `id`, `title`, `track`, `concept`, `prereqs` (optionally `prereqsAny`), `story`, `lesson` and `task`. Then add what its `kind` needs:

- **query** (the default): `endpoint`, `returns`, `starter`, `solution`, `check`, and optionally `needs` probes.
- **answer**: `answer`.
- **connect**: `defaultUrl`.
- **guide**: nothing more.

The list, tree and checker pick it up automatically.

## Running locally

Plain static files, no build step:

```bash
python3 -m http.server 8000
```

## Name

*Anableps*, the four-eyed fish behind the Koetai name, was established as a genus by Giovanni Antonio Scopoli in 1777.
