// Aucun babel.config.js n'existait avant ce fichier : Expo applique un
// preset par défaut (babel-preset-expo) même sans config explicite, ce qui
// suffisait tant qu'aucune lib ne demandait un plugin Babel particulier.
// react-native-reanimated (déjà installée, voir package.json) EN a besoin —
// voir plugins ci-dessous — d'où la création de ce fichier.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // DOIT rester le DERNIER plugin de ce tableau : exigence documentée
      // par Reanimated (son plugin transforme les "worklets" à partir du
      // code déjà transformé par tous les autres plugins/presets — le
      // placer avant un autre plugin risquerait de lui faire manquer du
      // code encore sous une forme qu'il ne sait pas analyser).
      //
      // Vérifié dans node_modules/react-native-reanimated/plugin/index.js :
      // avec Reanimated 4 (installé ici, voir package.json), ce spécificateur
      // est un simple alias vers react-native-worklets/plugin (le paquet
      // react-native-worklets est lui aussi déjà installé, dépendance de
      // Reanimated 4) — fonctionnellement identique, gardé sous ce nom car
      // c'est celui documenté officiellement pour l'installation.
      'react-native-reanimated/plugin',
    ],
  };
};
