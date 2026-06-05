# Extraction et sources originales

Ce dossier isole tout ce qui sert a reconstruire les assets depuis les sources TO8.

- `sources/disk/`: fichiers binaires autorises issus de la disquette originale, utilises par les outils d'extraction.
- `sources/runtime/memory.bin`: snapshot memoire de reference pour reconstruire les donnees graphiques et niveaux.
- `../tools/`: scripts de reconstruction et de provenance.
- `../docs/extraction/`: sorties generees en echelle 1:1 uniquement. Les variantes x4 ont ete supprimees.
- `../src/`: portage web moderne. Le runtime ne doit pas charger directement les fichiers `.bin`, `memory.bin`, `disk/*` ou les anciens bundles automatiques.

L'ancien portage automatique n'est plus conserve dans ce repo. Il peut encore servir comme oracle externe a certains extracteurs tant que toutes les routines ASM n'ont pas ete reimplementees ici, mais il ne fait pas partie du runtime web moderne.
