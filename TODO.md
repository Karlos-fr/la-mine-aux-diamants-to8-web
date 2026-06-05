- Faire un audit de l'archi, code mort, découpage logique, ...



Il est possible de traverser une rocher qui tombe.
Si le personnage creuse sous un diamant qui monte il doit récolter le diamant


- Au changement de niveau, le point de spawn animé ainsi que le personnage n'apparaissent pas
- L'écrasement des monstres ne marchent pas
- Animation IDL
- Changement de niveau

- Valider dans le code original la sequence temporaire d'apparition joueur: tile `0x04`, noir, repete 4 fois, puis affichage du joueur.
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
