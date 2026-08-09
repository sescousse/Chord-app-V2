// Logique de calcul de la STREAK (jours d'activité consécutifs) — PUR,
// aucun appel réseau ici : ne fait QUE calculer le nouvel état à partir de
// l'ancien + la date du jour. C'est ProfileContext.tsx qui appelle ça et
// écrit le résultat dans Supabase (voir validerActiviteDuJour là-bas).

export type ResultatStreak = {
  // Nouvelle valeur à écrire dans streak_actuelle.
  nouvelleStreak: number;
  // true si le jour était DÉJÀ validé aujourd'hui : dans ce cas, l'appelant
  // ne doit RIEN écrire dans Supabase ("ne rien changer", 2e règle du jeu).
  dejaValideAujourdhui: boolean;
  // Nouvelle valeur à écrire dans gels_serie — TOUJOURS renvoyée (même
  // inchangée) : l'appelant écrit cette valeur telle quelle, jamais besoin
  // de recalculer une décrémentation lui-même. Voir GEL DE SÉRIE plus bas.
  nouveauGelsSerie: number;
  // true si un gel de série a été consommé PENDANT CE calcul précis — pas
  // encore affiché nulle part (pas de notification/UI à cette étape),
  // exposé pour un futur message à l'utilisateur ("Un gel de série a
  // protégé ta série !").
  gelConsomme: boolean;
};

// Convertit une Date en chaîne "YYYY-MM-DD" en HEURE LOCALE de l'appareil.
//
// PIÈGE À ÉVITER : date.toISOString() convertit en UTC, PAS en heure locale
// — un utilisateur à 23h30 heure locale mais dont l'UTC est déjà le
// lendemain (fuseaux à l'est de Greenwich) verrait sinon sa journée validée
// pour le MAUVAIS jour (le lendemain au lieu d'aujourd'hui). getFullYear/
// getMonth/getDate ci-dessous lisent, eux, les composantes en heure LOCALE —
// c'est cette chaîne qu'on compare plus bas, et qu'on écrit dans la colonne
// Postgres "date" (qui n'a de toute façon pas de composante horaire :
// comparer des JOURS, jamais des horodatages complets, est tout le sujet ici).
export function formatDateLocale(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

// Calcule le nombre de jours ENTIERS entre 2 dates locales "YYYY-MM-DD"
// (dateLocaleB - dateLocaleA, en jours) — LE calcul critique de ce fichier,
// donc détaillé en profondeur :
//
// - Reconstruit chaque date à partir de ses 3 composantes séparées (année/
//   mois/jour), PAS via `new Date(dateLocale)` : ce dernier interpréterait
//   la chaîne "YYYY-MM-DD" comme un horodatage UTC minuit, retombant dans
//   le même piège de fuseau horaire que toISOString() (voir
//   formatDateLocale ci-dessus) dès qu'on la reconvertit ensuite en
//   millisecondes locales.
// - Fixe l'heure à MIDI (12h00) plutôt que minuit pour CHACUNE des 2 dates :
//   neutralise le changement d'heure été/hiver (DST). Un jour à cheval sur
//   ce changement ne dure pas exactement 24h en millisecondes réelles (23h
//   ou 25h selon le sens) — avec minuit, la soustraction de 2 dates de part
//   et d'autre de ce changement produirait un nombre de millisecondes qui
//   n'est PAS un multiple exact de 24h, et une simple division risquerait
//   d'arrondir vers le mauvais jour. Midi laisse au moins 12h de marge de
//   chaque côté, largement supérieure à l'écart DST habituel (1h) : le
//   résultat en jours reste donc exact même à cheval sur un changement
//   d'heure.
// - Math.round (pas Math.floor/ceil) sur le nombre de millisecondes divisé
//   par 24h : avec les 2 dates ancrées à midi, l'écart tombe déjà tout près
//   d'un nombre entier de jours — round absorbe la marge résiduelle
//   négligeable sans jamais dévier d'un jour entier.
function diffJoursEntre(dateLocaleA: string, dateLocaleB: string): number {
  const [anneeA, moisA, jourA] = dateLocaleA.split('-').map(Number);
  const [anneeB, moisB, jourB] = dateLocaleB.split('-').map(Number);

  const dateA = new Date(anneeA, moisA - 1, jourA, 12, 0, 0);
  const dateB = new Date(anneeB, moisB - 1, jourB, 12, 0, 0);

  const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;
  return Math.round((dateB.getTime() - dateA.getTime()) / MILLISECONDES_PAR_JOUR);
}

// CŒUR DE LA LOGIQUE — comparé en DATES LOCALES pures (chaînes "YYYY-MM-DD",
// jamais d'horodatage complet ni de fuseau UTC) :
//
// 1. dateDerniereActivite === aujourd'hui → déjà validé, on ne touche à
//    rien (dejaValideAujourdhui: true, l'appelant saute l'UPDATE Supabase).
// 2. dateDerniereActivite === null (PREMIÈRE activité jamais enregistrée) →
//    démarre directement à 1 (plus logique que "streakActuelle + 1" pour un
//    profil jamais actif).
// 3. Sinon, on calcule joursSautes = diffJoursEntre(...) - 1 : l'écart en
//    jours ENTRE la dernière activité et aujourd'hui vaut 1 pour "hier"
//    (jour consécutif normal, AUCUN jour sauté) — chaque jour d'écart
//    SUPPLÉMENTAIRE au-delà de 1 est un jour réellement sauté (aucune
//    activité enregistrée ce jour-là). Ex : avant-hier (écart = 2) → 1 jour
//    sauté (hier) ; il y a 3 jours (écart = 3) → 2 jours sautés.
//    - joursSautes === 0 (hier) → jour consécutif, +1, comportement
//      INCHANGÉ, aucun gel concerné.
//    - joursSautes >= 1 ET au moins 1 gel de série disponible → GEL DE
//      SÉRIE (voir le bloc dédié plus bas) : consomme TOUJOURS exactement
//      1 gel (jamais un par jour manqué), mais ne sauve la série QUE si
//      joursSautes === 1 (exactement 1 jour sauté) ; à partir de 2 jours
//      sautés, le gel est quand même consommé ("perdu dans le vide", choix
//      de jeu assumé) mais la série repart à 1 comme sans gel.
//    - joursSautes >= 1 SANS gel disponible → comportement normal, série
//      rompue, repart à 1, gels_serie inchangé.
export function calculerNouvelleStreak(
  dateDerniereActivite: string | null,
  streakActuelle: number,
  gelsSerieDisponibles: number,
  aujourdHui: Date,
): ResultatStreak {
  const aujourdHuiStr = formatDateLocale(aujourdHui);

  // Cas 1 : déjà actif aujourd'hui — rien ne change, gels_serie inclus.
  if (dateDerniereActivite === aujourdHuiStr) {
    return {
      nouvelleStreak: streakActuelle,
      dejaValideAujourdhui: true,
      nouveauGelsSerie: gelsSerieDisponibles,
      gelConsomme: false,
    };
  }

  // Cas 2 : jamais d'activité enregistrée — gels_serie n'a pas lieu d'être
  // touché non plus.
  if (dateDerniereActivite === null) {
    return {
      nouvelleStreak: 1,
      dejaValideAujourdhui: false,
      nouveauGelsSerie: gelsSerieDisponibles,
      gelConsomme: false,
    };
  }

  const joursSautes = diffJoursEntre(dateDerniereActivite, aujourdHuiStr) - 1;

  // Jour consécutif (hier, 0 jour sauté) : comportement INCHANGÉ.
  if (joursSautes === 0) {
    return {
      nouvelleStreak: streakActuelle + 1,
      dejaValideAujourdhui: false,
      nouveauGelsSerie: gelsSerieDisponibles,
      gelConsomme: false,
    };
  }

  // GEL DE SÉRIE — au moins 1 jour sauté, mais un gel est disponible.
  if (gelsSerieDisponibles >= 1) {
    // EXACTEMENT 1 jour sauté : le gel SAUVE la série, qui continue comme
    // si le jour manqué n'avait pas eu lieu (même traitement que le cas
    // "jour consécutif" ci-dessus : +1, pas de remise à 1).
    if (joursSautes === 1) {
      return {
        nouvelleStreak: streakActuelle + 1,
        dejaValideAujourdhui: false,
        nouveauGelsSerie: gelsSerieDisponibles - 1,
        gelConsomme: true,
      };
    }

    // 2 jours sautés OU PLUS : le gel est quand même consommé ("perdu dans
    // le vide", décision de jeu assumée) mais NE sauve PAS la série cette
    // fois — elle repart à 1 comme dans le cas sans gel.
    return {
      nouvelleStreak: 1,
      dejaValideAujourdhui: false,
      nouveauGelsSerie: gelsSerieDisponibles - 1,
      gelConsomme: true,
    };
  }

  // Aucun gel disponible : comportement normal, série rompue, repart à 1,
  // gels_serie inchangé.
  return {
    nouvelleStreak: 1,
    dejaValideAujourdhui: false,
    nouveauGelsSerie: gelsSerieDisponibles,
    gelConsomme: false,
  };
}
