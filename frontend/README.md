# ImprimCheques

Application web pour créer, prévisualiser et imprimer des chèques et des traites bancaires tunisiens (format 176 × 80 mm), avec interface multibanques (25 banques) et multi-comptes.

## Prérequis

- **Node.js LTS** — télécharger sur https://nodejs.org
- **Git** (optionnel — seulement si tu récupères le projet par `git clone`)
- Internet pour la première installation (téléchargement des dépendances)

## Installation sur un nouveau PC

1. Copier le dossier `imprimcheques-react` (ou `git clone`).
   **Important :** ne pas copier les dossiers `node_modules` et `dist`s'ils existent.
2. Ouvrir un terminal (invité de commandes / PowerShell) **dans le dossier du projet**.
3. Installer les dépendances :

   ```
   npm install
   ```

4. Construire l'application (copile + bundle) :

   ```
   npm run build
   ```

   En cas d'erreur TypeScript à l'étape précédente, essayer :

   ```
   npx vite build
   ```

5. Démarrer le serveur local :

   ```
   npx serve dist -l 4173 -s
   ```

   Ou avec Python (déjà installé sur la plupart des PC) :

   ```
   python -m http.server 4173 --directory dist
   ```

6. Ouvrir le navigateur à l'adresse : **http://localhost:4173**

## Données (comptes & banques)

Les comptes enregistrés sont stockés dans le **localStorage du navigateur** : ils ne sont pas partagés avec les autres utilisateurs. Sur un nouvel ordinateur, il faut :

- les **resaisir** via le formulaire de gestion des comptes, ou
- les **réimporter** depuis un fichier **CSV** exporté sur l'ancien poste (bouton d'export CSV de l'application).

## Configuration de l'imprimante (chèques 176 × 80 mm)

1. **Créer le format papier « Chèque »** :
   - Windows : `Périphériques et imprimantes` → clic droit sur l'imprimante → `Préférences d'impression` → onglet Papier/Qualité → Avancé → format papier personnalisé.
   - Largeur **176 mm**, hauteur **80 mm**.
2. **Imprimer (Ctrl+P)** :
   - Sélectionner le format **Chèque / 176 × 80 mm**.
   - Zoom / échelle : **100 %** (taille réelle — jamais « Ajuster à la page »).
   - **Marges : Aucune / Default**.
   - Cocher **« Imprimer les arrière-plans et graphiques »** (sinon les pointillés n'apparaissent pas).
   - Choisir le **bac** contenant les feuilles de chèque si nécessaire.
3. **Test** : faire un premier essai sur une feuille de brouillon. Si le contenu déborde ou se décale, ajuster le format papier de l'imprimante (pas le code).

## Scripts utiles

| Commande           | Rôle                                            |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Lance le serveur de développement (live reload) |
| `npm run build`    | Compile et génère le dossier `dist`             |
| `npm run preview`  | Sert le `dist` pour prévisualiser le build      |
| `npm run lint`     | Analyse le code (oxlint)                        |

## Structure du projet

- `src/App.tsx` — interface + aperçu du chèque + HTML d'impression (positions en mm)
- `src/index.css` — styles Tailwind
- `vite.config.ts` — configuration du build
- `start-server.bat` — raccourci pour lancer le serveur (adapter le chemin si le PC change)