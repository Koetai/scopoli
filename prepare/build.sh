#!/usr/bin/env bash
# Build Scopoli's rare-disease dataset: ORDO + HOOM + HPO + OFCO + Orphanet
# functional consequences, as five N-Triples files in ./data.
#
# Needs: curl, unzip, perl, Java 21+, Python 3 with rdflib, and Apache Jena's
# `riot` on your PATH (https://jena.apache.org/download/). ROBOT is fetched.
#
#   bash build.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p downloads data tools
cd downloads

ORDO_VERSION=4.9
HOOM_VERSION=2.6
OFCO_COMMIT=43c5989021d8d2ec83ae8fc03569891abc12c951
ROBOT_VERSION=v1.9.11

# fetch FILE URL: download once, retry on flaky connections, resume on rerun
fetch() {
  [ -s "$1" ] && { echo "   have $1"; return; }
  echo "   get  $1"
  curl -fSL --retry 5 --retry-all-errors --retry-delay 5 -o "$1.part" "$2" && mv "$1.part" "$1"
}

echo "== Downloading"
fetch "ORDO_en_${ORDO_VERSION}.owl" "https://www.orphadata.com/data/ontologies/ordo/last_version/ORDO_en_${ORDO_VERSION}.owl"
fetch "hoom_orphanet_${HOOM_VERSION}.zip" "https://www.orphadata.com/data/ontologies/hoom/hoom_orphanet_${HOOM_VERSION}.zip"
fetch OFCO.owl "https://raw.githubusercontent.com/Orphanet/ofco-ontology/${OFCO_COMMIT}/OFCO.owl"
fetch en_funct_consequences.xml "https://www.orphadata.com/data/xml/en_funct_consequences.xml"
fetch hp.owl "http://purl.obolibrary.org/obo/hp.owl"
fetch ../tools/robot.jar "https://github.com/ontodev/robot/releases/download/${ROBOT_VERSION}/robot.jar"
unzip -o -q "hoom_orphanet_${HOOM_VERSION}.zip"

echo "== ORDO, HPO and OFCO are RDF/XML: convert to N-Triples"
riot --output=nt "ORDO_en_${ORDO_VERSION}.owl" > ../data/ordo.nt
riot --output=nt hp.owl > ../data/hp.nt
riot --output=nt OFCO.owl > ../data/ofco.nt

echo "== HOOM is OWL/XML, which triplestores can't read: convert with ROBOT"
java -Xmx8G -jar ../tools/robot.jar convert --input "HOOM_en_${HOOM_VERSION}.owl" --format ttl --output hoom.ttl
# A few HOOM IRIs contain [ or ], which are not allowed in IRIs. Percent-encode
# them inside <...> only, so literals stay untouched.
riot --output=nt hoom.ttl 2>/dev/null \
  | perl -pe 's/<([^>]*)>/my $x=$1; $x=~s{\[}{%5B}g; $x=~s{\]}{%5D}g; "<$x>"/ge' > ../data/hoom.nt

echo "== Functional consequences: XML -> RDF, linked to ORDO and OFCO"
python3 "$HERE/fc_to_rdf.py" en_funct_consequences.xml OFCO.owl > fc.ttl
riot --output=nt fc.ttl > ../data/fc.nt

cd ../data
for f in *.nt; do riot --validate "$f"; done
wc -l *.nt
