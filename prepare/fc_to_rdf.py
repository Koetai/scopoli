#!/usr/bin/env python3
"""Turn Orphanet's functional-consequences XML into RDF that links ORDO and OFCO.

Orphadata publishes, for each rare disorder, which activities and participation
are limited (eating, walking, going to school...) as XML. Each limitation in that
XML carries an Orphanet database id. OFCO, the Orphanet Functional Consequences
Ontology, gives every limitation a class and records that same database id through
ofco:hasORPHANETDBInternalReference. This script uses that id to join the two and
writes one RDF node per disorder-limitation association.

Usage:
    python fc_to_rdf.py en_funct_consequences.xml OFCO.owl > functional_consequences.ttl
"""
import sys
import xml.etree.ElementTree as ET

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.namespace import RDF, RDFS, XSD

ORDO = Namespace("http://www.orpha.net/ORDO/")
OFCO = Namespace("https://w3id.org/ofco/")
FC = Namespace("https://koetai.github.io/scopoli/vocab#")
ASSOC = Namespace("https://koetai.github.io/scopoli/fc/association/")

OFCO_IDS = """
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT ?term ?id WHERE {
  ?term owl:equivalentClass/owl:intersectionOf/rdf:rest*/rdf:first ?r .
  ?r owl:onProperty <https://w3id.org/ofco/hasORPHANETDBInternalReference> ;
     owl:hasValue ?id .
}
"""


def ofco_terms(path):
    """Map Orphanet database id -> OFCO class IRI."""
    ofco = Graph().parse(path, format="xml")
    return {int(row.id): row.term for row in ofco.query(OFCO_IDS)}


def convert(xml_path, ofco_path):
    terms = ofco_terms(ofco_path)
    g = Graph()
    g.bind("ordo", ORDO)
    g.bind("ofco", OFCO)
    g.bind("fc", FC)

    unmapped = set()
    for rel in ET.parse(xml_path).getroot().iter("DisorderDisabilityRelevance"):
        disorder = ORDO["Orphanet_" + rel.findtext("Disorder/OrphaCode")]
        for a in rel.iter("DisabilityDisorderAssociation"):
            db_id = int(a.find("Disability").get("id"))
            if db_id not in terms:
                unmapped.add(db_id)
                continue
            node = ASSOC[a.get("id")]
            g.add((node, RDF.type, FC.FunctionalConsequence))
            g.add((node, FC.disorder, disorder))
            g.add((node, FC.limitation, terms[db_id]))
            for prop, path in [(FC.frequency, "FrequenceDisability/Name"),
                               (FC.temporality, "TemporalityDisability/Name"),
                               (FC.severity, "SeverityDisability/Name")]:
                value = a.findtext(path)
                if value:
                    g.add((node, prop, Literal(value)))
            g.add((node, FC.lossOfAbility, Literal(a.findtext("LossOfAbility") == "y", datatype=XSD.boolean)))

    g.add((FC.FunctionalConsequence, RDFS.label, Literal("Functional consequence of a rare disorder", lang="en")))
    if unmapped:
        print(f"warning: {len(unmapped)} disability ids without an OFCO term: {sorted(unmapped)}", file=sys.stderr)
    return g


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.stdout.write(convert(sys.argv[1], sys.argv[2]).serialize(format="turtle"))
