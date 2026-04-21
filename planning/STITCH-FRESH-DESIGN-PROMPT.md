# Stitch Fresh Design Prompt

Use this prompt when asking Stitch to restart the Jotly product design from zero.

```md
Je veux repartir de zero sur le design complet de Jotly.

Produit :
Jotly est une application de productivite personnelle utilisee plusieurs fois par jour. Elle aide l'utilisateur a piloter sa journee, ses taches, ses rappels, ses notes, son calendrier, ses bilans et sa progression personnelle. L'experience doit donner envie de revenir regulierement, sans etre agressive ni fatigante.

Direction UX/UI :
- Mobile first, puis declinaison desktop.
- Sobriete, elegance, qualite percue elevee.
- Interface calme, premium, lisible, agreable a ouvrir plusieurs fois par jour.
- Couleurs non agressives, pas trop excitantes, pas trop saturees.
- Eviter les palettes trop flashy, trop gaming, trop enfantines ou trop marketing.
- Creer une sensation de focus, de maitrise et de douceur.
- Laisser libre cours a l'imagination : ne pas recopier l'interface existante.
- Ne pas forcer toutes les fonctionnalites a apparaitre comme des blocs separes si une meilleure UX les regroupe naturellement.
- Le design doit etre reellement utilisable, pas une landing page.
- Priorite aux workflows quotidiens efficaces, a la clarte, et a une experience qui accompagne la performance sans pression excessive.

Public cible :
Utilisateurs qui veulent organiser leur journee, suivre leur performance, garder leur contexte de travail, faire des bilans, retrouver leurs notes et avancer avec une sensation de controle.

Surfaces a concevoir :

1. Authentification
Plateformes : mobile + desktop
Inclure :
- connexion
- creation de compte
- mot de passe oublie
- reinitialisation du mot de passe
Etats :
- chargement
- erreur
- succes / information
Objectif :
Creer une entree sobre, rassurante, elegante, pas marketing.

2. Dashboard quotidien
Plateformes : mobile + desktop
Objectif :
Permettre a l'utilisateur de comprendre rapidement sa journee.
Donnees possibles :
- date active
- progression du jour
- taches totales / actionnables / terminees
- temps planifie
- alertes importantes
- prochaine action
- affirmation du jour
- rappels
- evenements calendrier
- bilan du jour
Actions possibles :
- changer de date
- revenir a aujourd'hui
- creer une tache
- reporter les taches d'hier
- ouvrir les alertes
- ouvrir le calendrier
- ouvrir le bilan
Important :
Le dashboard doit etre le cockpit principal, pas une collection confuse de cartes.

3. Kanban / taches
Plateformes : mobile + desktop
Objectif :
Gerer les taches par statut.
Statuts :
- a faire
- en cours
- termine
- annule
Donnees tache :
- titre
- description
- priorite
- projet
- date cible
- echeance
- temps prevu
- statut
- lien eventuel avec un evenement calendrier
Actions :
- creer
- editer
- supprimer
- deplacer entre statuts
- filtrer/rechercher
Mobile :
Imaginer une UX fluide, tactile, peut-etre horizontale ou autrement adaptee au petit ecran.
Desktop :
Plus dense, oriente workspace.

4. Detail / creation / edition de tache
Plateformes : mobile + desktop
Inclure :
- titre
- description riche
- statut
- priorite
- projet
- date cible
- echeance
- temps prevu
- commentaires
- fichiers joints
- recurrence
- lien calendrier
Etats :
- creation
- edition
- suppression
- validation d'erreurs
Ne pas faire un formulaire lourd si une meilleure experience progressive est possible.

5. Calendrier
Plateformes : mobile + desktop
Objectif :
Afficher le contexte Google Calendar synchronise.
Donnees :
- evenements du jour
- heure
- duree
- compte/calendrier source
- lieu/lien eventuel
- note interne liee
- taches liees
Actions :
- creer une tache depuis un evenement
- ouvrir ou creer une note liee a un evenement
- filtrer/rechercher les evenements
Etat vide :
- aucun compte connecte
- aucun evenement ce jour

6. Rappels
Plateformes : mobile + desktop
Inclure :
- liste des rappels actifs
- rappels en retard
- rappels a venir
- rappel termine / annule
- creation / edition d'un rappel
Donnees :
- titre
- description
- date/heure
- projet
- personnes concernees
- fichiers joints
Actions :
- creer
- modifier
- terminer
- annuler
- supprimer
Design :
Les rappels doivent etre utiles sans etre anxiogenes.

7. Notes
Plateformes : mobile + desktop
Inclure :
- liste des notes
- notes libres
- notes liees a une date
- notes liees a un evenement calendrier
- creation / edition de note
- documents joints
Actions :
- creer
- modifier
- supprimer
- ouvrir les documents
Design :
La prise de note doit etre rapide, calme, et agreable.

8. Recherche globale
Plateformes : mobile + desktop
Objectif :
Retrouver rapidement tout ce qui existe dans l'espace Jotly.
Sources :
- taches
- commentaires
- notes
- rappels
- evenements calendrier
- bilans
- affirmations
- fichiers
Actions :
- taper une requete
- filtrer par type
- filtrer par periode
- ouvrir un resultat
Etats :
- recherche vide
- resultats recents
- chargement
- aucun resultat
- erreur

9. Assistant IA
Plateformes : mobile + desktop
Objectif :
Aider l'utilisateur a prioriser, synthetiser et comprendre son workspace.
Usages :
- demander les priorites du jour
- identifier les blocages
- resumer les taches
- preparer un plan d'action
- retrouver du contexte
Important :
L'assistant doit paraitre utile et discret, pas envahissant.
Desktop :
Peut etre un panneau lateral ou une surface dediee.
Mobile :
Doit rester accessible sans gener la navigation.

10. Alertes
Plateformes : mobile + desktop
Objectif :
Montrer les elements necessitant une action.
Types :
- taches en retard
- taches dues aujourd'hui
- taches dues demain
- rappels en retard
- rappels a venir
Actions :
- ouvrir l'element
- terminer un rappel
- annuler un rappel
Etat vide :
- aucune alerte active

11. Profil / parametres
Plateformes : mobile + desktop
Inclure :
- nom affiche
- langue
- fuseau horaire
- preferences de synthese hebdomadaire
- preferences de synthese mensuelle
- connexions Google Calendar
- synchronisation calendrier
- choix du calendrier
- couleur de calendrier
- deconnexion calendrier
Design :
Parametres clairs, organises, pas techniques.

12. Suivi de performance / gaming track
Plateformes : mobile + desktop
Objectif :
Donner une lecture motivante mais sobre de la performance.
Donnees possibles :
- score global
- execution
- reflexion
- consistance
- momentum
- series
- missions hebdomadaires
- badges
- niveaux
- tendances historiques
- meilleur score personnel
- recapitulatif
Important :
Ne pas tomber dans un style arcade ou trop gamifie. Le suivi doit etre motivant, mature et elegant.

13. Bilans et objectifs periodiques
Plateformes : mobile + desktop
Inclure :
- affirmation du jour
- bilan du jour
- objectif hebdomadaire
- bilan hebdomadaire
- objectif mensuel
- bilan mensuel
Donnees :
- humeur
- victoires
- blocages
- lecons
- top 3 du lendemain
- objectif principal
- revue de periode
Design :
Ces surfaces doivent encourager la reflexion sans creer de surcharge.

14. Planning projet
Plateforme : surtout desktop, prevoir adaptation mobile si pertinent
Objectif :
Voir les taches sous forme plus globale.
Donnees :
- taches par projet
- statut
- priorite
- date cible
- echeance
- duree prevue
- vue tableau
- vue timeline / planning
Actions :
- filtrer
- trier
- ouvrir une tache
- creer une tache
Design :
Workspace dense, propre, professionnel.

Etats globaux a couvrir :
- chargement
- vide
- erreur
- succes
- desactive
- contenu long
- contenu tres court
- beaucoup d'elements
- premiere utilisation
- utilisateur avance avec beaucoup de donnees

Livrables attendus :
- proposer une architecture complete des ecrans
- generer les ecrans mobile d'abord
- generer ensuite les variantes desktop
- nommer clairement chaque ecran
- ne pas produire uniquement des mockups isoles : penser les transitions et la navigation globale
- inclure les overlays ou panneaux importants : creation tache, detail tache, recherche, assistant, alertes, profil, formulaire rappel, formulaire note
- si certaines fonctionnalites peuvent etre fusionnees dans une meilleure experience, proposer cette fusion
- si certaines surfaces semblent inutiles en ecran separe, les integrer elegamment ailleurs

Contraintes importantes :
- L'application est utilisee plusieurs fois par jour.
- L'interface doit rester calme et desirable sur la duree.
- Prioriser la qualite d'usage, la lisibilite, la hierarchie claire et la fluidite.
- Ne pas utiliser de couleurs agressives.
- Ne pas surcharger avec trop de cartes decoratives.
- Ne pas faire une landing page.
- Ne pas copier l'ancien design.
- Proposer un nouveau systeme visuel coherent mobile + desktop.
```
