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

// Calcule la veille d'une date locale "YYYY-MM-DD", sous la même forme.
// Reconstruit une Date à partir des 3 composantes séparées (année/mois/jour
// — PAS `new Date(dateLocale)`, qui interpréterait la chaîne "YYYY-MM-DD"
// comme un horodatage UTC minuit, retombant dans le même piège de fuseau
// horaire que toISOString() ci-dessus) puis lui retranche un jour ; le
// "débordement" (ex : 1er du mois moins 1 jour → dernier jour du mois
// précédent) est géré automatiquement par le constructeur Date de JS.
function calculerVeille(dateLocale: string): string {
  const [annee, mois, jour] = dateLocale.split('-').map(Number);
  const date = new Date(annee, mois - 1, jour);
  date.setDate(date.getDate() - 1);
  return formatDateLocale(date);
}

// CŒUR DE LA LOGIQUE — 3 cas, comparés en DATES LOCALES pures (chaînes
// "YYYY-MM-DD", jamais d'horodatage complet ni de fuseau UTC) :
//
// 1. dateDerniereActivite === aujourd'hui → déjà validé, on ne touche à
//    rien (dejaValideAujourdhui: true, l'appelant saute l'UPDATE Supabase).
// 2. dateDerniereActivite === veille d'aujourd'hui, OU null (PREMIÈRE
//    activité jamais enregistrée) → jour consécutif : +1 par rapport à
//    streakActuelle (le cas "null" est traité à part, juste en dessous,
//    car démarrer directement à 1 a plus de sens que "streakActuelle + 1"
//    pour un profil qui n'a jamais encore été actif).
// 3. Tout le reste (plus vieux que la veille — un ou plusieurs jours
//    sautés) → la série est rompue, elle repart à 1 (aujourd'hui compte
//    comme le 1er jour d'une nouvelle série).
export function calculerNouvelleStreak(
  dateDerniereActivite: string | null,
  streakActuelle: number,
  aujourdHui: Date,
): ResultatStreak {
  const aujourdHuiStr = formatDateLocale(aujourdHui);

  // Cas 1 : déjà actif aujourd'hui.
  if (dateDerniereActivite === aujourdHuiStr) {
    return { nouvelleStreak: streakActuelle, dejaValideAujourdhui: true };
  }

  // Cas 2 (variante "première activité") : jamais d'activité enregistrée.
  if (dateDerniereActivite === null) {
    return { nouvelleStreak: 1, dejaValideAujourdhui: false };
  }

  const veilleStr = calculerVeille(aujourdHuiStr);

  // Cas 2 : actif hier → jour consécutif.
  if (dateDerniereActivite === veilleStr) {
    return { nouvelleStreak: streakActuelle + 1, dejaValideAujourdhui: false };
  }

  // TODO: gel de série — si gels_serie > 0 ET dateDerniereActivite ===
  // avant-veille d'aujourd'hui (UN SEUL jour sauté, pas plus), consommer un
  // gel ici (décrémenter gels_serie côté appelant, dans ProfileContext.tsx)
  // et traiter ce cas comme le cas 2 ci-dessus (streakActuelle + 1) plutôt
  // que la remise à 1 qui suit. Nécessiterait de faire remonter gels_serie
  // en paramètre de cette fonction (pas fait ici, hors périmètre).

  // Cas 3 : jour(s) sauté(s) → série rompue, on repart à 1.
  return { nouvelleStreak: 1, dejaValideAujourdhui: false };
}
