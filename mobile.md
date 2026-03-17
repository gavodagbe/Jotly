# Strategie d'implementation de la version mobile de Jotly

## Etat actuel du produit

Au 17 mars 2026, Jotly existe comme application web `Next.js` dans `frontend/` avec un backend `Fastify` dans `backend/`.
Le backend expose deja une API JSON authentifiee par bearer token et porte la logique metier principale.
Le frontend web reste tres concentre dans `frontend/src/components/layout/app-shell.tsx`, qui depasse 10 000 lignes.
Le client web appelle le backend via des URLs relatives `/backend-api/...` resolues par un rewrite Next.js.
Le backend n'expose pas encore de configuration CORS pour un client mobile autonome.
Le flux Google Calendar OAuth redirige aujourd'hui vers `FRONTEND_ORIGIN`, donc vers le web.
L'upload de pieces jointes repose sur des `data:` URLs, ce qui est acceptable sur web mais mauvais fit pour mobile a cause de la memoire et des tailles de payload.
Les modules explicitement non implementes dans le cadrage actuel restent: mobile client, notifications, real-time sync, offline-first.

## Objectif

Construire un client mobile iOS/Android qui couvre le workflow journalier principal de Jotly sans dupliquer la logique metier, sans destabiliser le web existant et sans ouvrir trop tot les sujets hors scope comme l'offline-first ou les notifications push.

## Principes directeurs

- Le backend reste la source de verite pour toutes les regles metier.
- Le mobile ne doit pas recreer une logique parallele au web.
- La parite fonctionnelle sera progressive, pas immediate.
- L'UX mobile doit etre native et adaptee au telephone, pas une reduction du Kanban desktop.
- La V1 mobile reste online-first.
- La V1 mobile ne depend pas du real-time sync.
- La V1 mobile ne doit pas forcer une refonte generale du frontend web avant de livrer une premiere version utile.

## Choix d'architecture recommande

### Option retenue

Creer une nouvelle application `mobile/` dans le monorepo avec `Expo`, `React Native` et `TypeScript`.

### Pourquoi Expo / React Native

- Time-to-market plus court qu'un double client natif iOS/Android.
- Bon support du deep linking, du secure storage, des builds et de la distribution.
- Bonne capacite de mutualisation avec le code TypeScript existant.
- Convient a une application fortement centre sur formulaires, listes, navigation date par date et interactions CRUD.

### Structure cible

```text
mobile/
  app/
  src/components/
  src/features/
  src/lib/
  src/theme/
packages/
  api-client/
  domain/
  ui-tokens/        (optionnel au depart)
```

### Bibliotheques recommandees

- `expo` + `expo-router` pour la navigation.
- `@tanstack/react-query` pour l'etat serveur et le cache reseau.
- `expo-secure-store` pour le bearer token.
- `react-native-gesture-handler` et `react-native-reanimated` pour les interactions mobiles.
- `zod` dans le package partage de contrat et validation.
- `jest-expo` + `@testing-library/react-native` pour les tests unitaires/composants.
- `Maestro` pour les parcours e2e mobiles prioritaires.

## Architecture applicative cible

### 1. Partage du domaine

Avant de livrer beaucoup d'ecrans mobiles, il faut extraire du code partage depuis `app-shell.tsx` vers des packages reutilisables:

- Types metier: `Task`, `Reminder`, `DayAffirmation`, `DayBilan`, `CalendarEvent`, `GamingTrackSummary`.
- Enums et helpers: statuts, priorites, frequences de recurrence, gestion de date, formatage pur.
- Contrats d'API et helpers de parsing.
- Fonctions de normalisation qui ne dependent ni du DOM ni de Next.js.

Le but n'est pas de mutualiser les composants visuels web/mobile, mais de mutualiser le contrat et le comportement pur.

### 2. Client API partage

Le mobile ne doit pas consommer les endpoints via `/backend-api/...` comme le web.
Il faut extraire un client API configurable par base URL absolue, par exemple dans `packages/api-client`.

Ce package devra gerer:

- `API_BASE_URL`.
- Ajout automatique du header `Authorization: Bearer <token>`.
- Normalisation de la forme d'erreur existante.
- Fonctions par domaine: auth, tasks, reminders, day affirmation, day bilan, comments, recurrence, assistant, gaming track, calendar.

### 3. Persistance locale

Pour la V1:

- Token auth dans `expo-secure-store`.
- Preferences d'UI non sensibles dans `AsyncStorage` ou `MMKV`.
- Cache serveur via React Query.

Ne pas introduire une base offline locale complete dans la premiere livraison.

### 4. Navigation mobile

Ne pas recopier la sidebar desktop.
Adopter une structure mobile simple:

- Onglet `Jour`: vue principale centree sur la date selectionnee.
- Onglet `Rappels`: liste et traitement des reminders.
- Onglet `Assistant`: interface conversationnelle, si inclus dans la vague retenue.
- Onglet `Profil`: preferences, session, Google Calendar plus tard.

Les formulaires de tache, rappel et bilan doivent s'ouvrir en bottom sheet ou plein ecran selon la complexite.

## UX mobile recommandee

### Ecran principal

Le desktop repose sur un Kanban 4 colonnes. Sur mobile, ce pattern ne doit pas etre porte tel quel.

Le bon compromis pour la V1:

- Header compact avec navigation de date.
- Resume du jour en haut: progression, affirmation, alertes, eventuels rappels.
- Liste de taches regroupee par statut ou filtree par onglets.
- Actions rapides sur les cartes: changer le statut, editer, supprimer, replanifier.
- FAB pour creer une tache.

### Gestion des statuts

Ne pas reproduire le drag-and-drop desktop.
Sur mobile, preferer:

- swipe actions;
- menu d'actions;
- boutons de transition de statut dans la fiche tache.

### Dialogue de tache

La fiche tache mobile doit couvrir:

- titre;
- description;
- statut;
- date cible;
- due date;
- priorite;
- projet;
- temps planifie;
- recurrence plus tard dans la parite etendue;
- lien calendar event plus tard dans la parite etendue.

### Modules journaliers

La version mobile V1 doit privilegier les usages a haute frequence:

- consulter les taches du jour;
- mettre a jour un statut;
- creer/editer une tache;
- faire le carry-over d'hier;
- remplir l'affirmation du jour;
- remplir le bilan du jour;
- consulter et traiter les rappels.

## Scope recommande par vagues

### Vague 0 - Preparation et cadrage technique

Objectif: preparer l'architecture sans lancer trop tot une implementation UI complete.

Travaux:

- valider le scope exact de la V1 mobile;
- figer la structure `mobile/` et `packages/`;
- definir la navigation cible;
- inventorier les fonctions pures a extraire de `app-shell.tsx`;
- definir la liste des endpoints requis pour la premiere livraison;
- ecrire les conventions d'env mobile: `EXPO_PUBLIC_API_BASE_URL`, deep links, environments.

Sortie attendue:

- architecture mobile validee;
- backlog technique ordonne;
- decisions de scope V1, V1.1 et hors scope.

### Vague 1 - Mise a niveau backend pour un client mobile

Objectif: rendre l'API reellement consommable par une application native.

Travaux:

- ajouter CORS cote backend avec une configuration explicite par environnement;
- verifier que tous les endpoints requis fonctionnent correctement hors meme origine;
- documenter et figer la duree de vie du bearer token et le comportement sur 401;
- introduire une configuration de redirection OAuth compatible mobile pour Google Calendar;
- verifier que toutes les erreurs renvoient une forme stable et exploitable par mobile;
- ajouter les tests backend pour les changements de configuration mobile.

Points d'attention:

- aujourd'hui, `backend/src/app.ts` n'enregistre pas de plugin CORS;
- le callback Google Calendar redirige vers `FRONTEND_ORIGIN`, ce qui ne convient pas a une app native;
- les pieces jointes ne doivent pas etre portees sur mobile tant que l'upload repose sur des `data:` URLs.

### Vague 2 - Extraction du code partage

Objectif: reduire le couplage au web avant de multiplier les ecrans mobiles.

Travaux:

- extraire les types metier depuis `frontend/src/components/layout/app-shell.tsx`;
- extraire les helpers de dates, de formatage et de normalisation purs;
- extraire un client HTTP partage independant de Next.js;
- conserver le rendu web en place pour limiter le risque de regression;
- couvrir le code partage par tests unitaires.

Sortie attendue:

- packages reutilisables par le web et le mobile;
- premier affaiblissement du monolithe `app-shell.tsx` sans refonte massive.

### Vague 3 - Fondation mobile

Objectif: poser une application mobile saine avant les features metier.

Travaux:

- initialiser `mobile/` avec Expo Router;
- mettre en place theming, composants de base, loading, erreurs et empty states;
- integrer React Query;
- implementer le bootstrap de session avec `expo-secure-store`;
- brancher login, register, me, logout, forgot password, reset password;
- gerer locale et fuseau a partir du profil utilisateur;
- preparer l'observabilite minimale: logs, crash reporting si retenu.

Definition of done:

- un utilisateur peut s'authentifier, fermer puis rouvrir l'app, et retrouver sa session;
- les requetes partent vers une base URL absolue configurable;
- les etats de chargement et d'erreur sont homogenes.

### Vague 4 - Mobile MVP: workflow journalier

Objectif: rendre possible l'usage quotidien de Jotly depuis un telephone sans ouvrir le web.

Scope V1 recommande:

- vue jour avec navigation de date;
- chargement des taches par date;
- creation, edition, suppression de tache;
- changement de statut;
- replanification explicite;
- indicateurs de progression du jour;
- day affirmation;
- carry-over de la veille;
- day bilan;
- reminders list, create, update, dismiss, delete;
- profil et preferences de base.

Choix produit:

- le mobile MVP remplace le Kanban 4 colonnes par une liste optimisee telephone;
- le drag-and-drop n'est pas un prerequis de la V1;
- les raccourcis d'actions sont plus importants que la parite visuelle avec le desktop.

Definition of done:

- un utilisateur peut executer son flux journalier principal depuis iPhone et Android;
- la logique metier reste 100% backend;
- aucune donnee critique n'est geree uniquement cote mobile.

### Vague 5 - Parite etendue apres V1

Objectif: rapprocher le mobile du web sur les modules deja existants cote backend.

Priorites recommandees:

- comments;
- recurrence;
- gaming track summary;
- lecture des events Google Calendar deja synchronises;
- notes sur events;
- creation de tache depuis un event synchronise;
- assistant workspace-first;
- personnalisation du dashboard mobile.

Ce qui peut rester hors de la premiere extension:

- configuration complete de Google Calendar depuis mobile;
- upload de pieces jointes;
- edition avancee riche equivalent web.

### Vague 6 - Capacites mobiles avancees

Objectif: ouvrir les sujets specifiquement mobiles seulement une fois le coeur stable.

Travaux possibles:

- deep linking complet pour Google Calendar connect/disconnect;
- pieces jointes mobiles apres migration backend vers `multipart/form-data` ou stockage objet;
- notifications push pour reminders et alertes;
- mode lecture degradee avec cache local;
- analytics d'usage et instrumentation produit;
- publication stores et cycle de release mobile.

Ces sujets ne doivent pas bloquer la sortie de la V1.

## Changements backend indispensables

### CORS

Ajout obligatoire pour permettre les appels depuis l'application mobile.

### OAuth Google Calendar

Le backend doit pouvoir rediriger non seulement vers `FRONTEND_ORIGIN`, mais aussi vers un deep link mobile ou une page de pont mobile.

### Pieces jointes

Le protocole actuel par `data:` URL ne doit pas etre etendu au mobile.
Avant d'activer les pieces jointes mobiles, il faut:

- passer a `multipart/form-data` ou a un upload objet dedie;
- separer le transport du binaire et la creation des metadonnees;
- verifier les tailles limites et la memoire mobile.

### Documentation d'API

Sans aller jusqu'a une refonte OpenAPI complete si ce n'est pas prioritaire, il faut au minimum:

- lister les endpoints consommes par le mobile;
- figer les payloads critiques;
- centraliser les conventions d'erreur et d'auth.

## Priorisation fonctionnelle recommandee

### A inclure dans la V1

- authentication complete;
- vue jour;
- CRUD de taches;
- changement de statut;
- replanification;
- day affirmation;
- carry-over;
- day bilan;
- reminders;
- profil.

### A inclure en V1.1

- comments;
- recurrence;
- gaming track;
- calendar events deja synchronises;
- assistant.

### A laisser hors scope V1

- notifications push;
- offline-first;
- real-time sync;
- upload de pieces jointes tant que le backend n'a pas change de strategie;
- Google Calendar OAuth complet dans l'app si le deep linking n'est pas encore pret;
- write-back Google Calendar.

## Strategie de test

### Backend

- etendre les tests `node --test` pour CORS, OAuth redirect mobile et tout changement d'API utile au mobile.

### Packages partages

- tests unitaires sur les helpers de dates, les mappers, les validateurs et le client API.

### Mobile

- tests unitaires sur composants critiques et hooks;
- smoke tests Maestro sur:
  - login;
  - chargement de la journee;
  - creation de tache;
  - changement de statut;
  - save affirmation;
  - save bilan;
  - dismiss reminder;
- verification manuelle iOS et Android sur petit et grand ecran.

## Risques principaux et mitigations

### Risque 1 - Le monolithe web ralentit la livraison mobile

Mitigation:

- extraire uniquement le code partage pur;
- ne pas essayer de mutualiser les composants visuels;
- avancer par extractions incrementales testees.

### Risque 2 - Refaire un Kanban desktop sur telephone

Mitigation:

- adopter une UX mobile specifique;
- privilegier liste, filtres et actions rapides au drag-and-drop.

### Risque 3 - Sous-estimer les integrations web-specifiques

Mitigation:

- traiter tot CORS, base URL absolue et OAuth redirect;
- considerer Google Calendar connect comme une extension si le deep linking n'est pas pret.

### Risque 4 - Upload de fichiers non adapte au mobile

Mitigation:

- sortir les pieces jointes du MVP mobile;
- faire une migration de protocole avant d'activer cette fonctionnalite.

### Risque 5 - Scope trop large des la premiere release

Mitigation:

- sortir d'abord le workflow journalier principal;
- reporter les modules de confort et les sujets mobiles avances.

## Ordre d'execution recommande

1. Vague 0: cadrage et architecture.
2. Vague 1: readiness backend mobile.
3. Vague 2: extraction du code partage.
4. Vague 3: fondation Expo + auth.
5. Vague 4: workflow journalier MVP.
6. Vague 5: parite etendue selon usage reel.
7. Vague 6: capacites mobiles avancees.

## Recommandation finale

La meilleure strategie pour Jotly n'est pas de "porter le frontend web sur mobile", mais de construire un client Expo autonome centre sur la journee, en reutilisant le backend existant et en extrayant progressivement les contrats et helpers aujourd'hui enfouis dans `app-shell.tsx`.

Le succes de la version mobile depend moins de la quantite d'ecrans livres que de trois decisions executees tot:

- rendre l'API consommable hors web via CORS et base URL absolue;
- sortir le contrat metier partage du monolithe frontend;
- limiter la V1 au workflow journalier a forte frequence.
