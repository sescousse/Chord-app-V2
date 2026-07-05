# Piano App

Application mobile universelle (iOS & Android, via Expo) pour apprendre le piano : cours et exercices interactifs.

## Stack technique

- [Expo](https://docs.expo.dev/) + React Native (TypeScript)
- [React Navigation](https://reactnavigation.org/) (navigation par onglets)

## Structure du projet

```
App.tsx                  Point d'entrée, monte la navigation
src/
  navigation/             Configuration de la navigation (onglets, écrans)
  screens/                Un fichier par écran (Accueil, Cours, Exercices, Profil)
  theme/                  Couleurs et constantes de style partagées
  components/             Composants UI réutilisables (à venir)
```

Cette base ne contient que le squelette de navigation avec des écrans vides :
elle est destinée à être complétée avec les fonctionnalités (contenu des cours,
exercices interactifs, clavier de piano, progression, etc.) et le design final.

## Démarrer le projet

```bash
npm install
npm start        # ouvre Expo Dev Tools, scanner le QR code avec l'app Expo Go
npm run ios      # nécessite macOS + Xcode
npm run android  # nécessite Android Studio / un émulateur
npm run web      # aperçu rapide dans le navigateur
```
