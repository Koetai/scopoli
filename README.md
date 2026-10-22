# Scopoli — learn SPARQL through biomedical problems

A [Koetai](https://koetai.github.io/) product. Scopoli is a [Rosalind](https://rosalind.info)-style problem site for SPARQL. It has 21 problems in three tracks, and each one is a small biomedical research question answered with a live query:

- **Wikidata**: triple patterns, OPTIONAL, FILTER, aggregates, property paths, UNION, NOT EXISTS, VALUES
- **UniProt & SIB**: UniProt core vocabulary, Gene Ontology, federation with Rhea, Wikidata → UniProt bridging
- **RDF Portal** (DBCLS): MeSH, ChEMBL and ClinVar in named graphs

**Live:** https://koetai.github.io/scopoli/

## How answers are checked

On *Submit*, the browser runs the learner's query and the problem's reference `solution` against the same endpoint. It then compares the sets of values in the problem's `check` columns. Both queries run on the current data, so answers stay valid as the knowledge graphs evolve. Progress is kept in `localStorage`.

## Adding a problem

Append an object to `PROBLEMS` in [`problems.js`](problems.js) with `id`, `title`, `track`, `endpoint`, `concept`, `prereqs`, `story`, `lesson`, `task`, `returns`, `sample`, `hint`, `starter`, `solution`, `check` and `explain`. The list, tree and checker pick it up automatically.

## Running locally

Plain static files, no build step:

```bash
python3 -m http.server 8000
```

## Name

*Anableps*, the four-eyed fish behind the Koetai name, was established as a genus by Giovanni Antonio Scopoli in 1777.
