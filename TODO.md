- Faire un audit de l'archi, code mort, découpage logique, ...

- Vérifier l'IA des créatures



- Sequence apparition joueur validee via `KIT.BIN:$BE68`: 6 demi-etapes, donc 3 cycles `0x04`/noir avant affichage joueur.
- Implementer les animations de l'ecran 2


- Enregistrer le reccord en local
- Gestion du son
- Gestion des autres monstres
- - Niveau secret Infogram
- [ ] Ajouter si besoin un viewer de tuiles runtime et de niveaux JSON.

La mine aux diamants

Fonctionnalites
- Editeur de niveaux
- Generateur procedural de niveaux via seed
- Interface multilingue
- Bruitage
- Musique
- Mondes thematiques (nouvelles tiles & monstres)
- Mode versus en local ou a distance

Graphique
- Particules pixelisees: poussiere quand on creuse.
- Tremblement d'ecran leger quand un gros rocher tombe, explosion, etc.
- Flash quand on ramasse un gros paquet de diamants.
- Augmentation des frames des animations.
- Variantes de mineur (skins).

Controles
- Input buffering: si le joueur appuie legerement avant d'arriver a une intersection, le mouvement est memorise.
- Deplacement plus fluide: interpoler graphiquement entre les cases.

Animations
- Eboulements plus lisibles: legere acceleration, petit effet de chute.
- Diamants qui scintillent: luminosite qui varie.



Paramètres :
Mouvements fluides 
taille grille affichée
