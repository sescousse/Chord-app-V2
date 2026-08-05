// Une cadence : une séquence de degrés à AJOUTER en fin de progression (voir
// withCadence ci-dessous, et son utilisation dans improResult.tsx). Exprimée
// en DEGRÉS — jamais en accords concrets — pour rester TRANSPOSABLE à
// n'importe quelle tonique/mode, même principe que les progressions de
// progression.ts : c'est degreeToChord/buildExtendedChord (déjà utilisés
// pour TOUT degré affiché sur l'écran résultat) qui les convertissent en
// accords concrets, sans code supplémentaire à écrire pour ça.
export type Cadence = {
  id: string;
  name: string;
  degrees: string[];
};

// Les 4 cadences proposées. ORDRE volontaire : les 3 cadences à 2 degrés
// d'abord, la demi-cadence (1 seul degré) en dernier — voir
// findExistingCadence juste en dessous, qui s'arrête à la PREMIÈRE cadence
// dont la fin correspond : place les motifs les plus SPÉCIFIQUES (2 degrés
// précis) avant le plus général (1 seul degré, qui matche dès que le tout
// dernier degré est un V, quoi qu'il y ait avant).
export const CADENCES: Cadence[] = [
  { id: 'perfect', name: 'Parfaite', degrees: ['V', 'I'] },
  { id: 'plagal', name: 'Plagale', degrees: ['IV', 'I'] },
  { id: 'deceptive', name: 'Rompue', degrees: ['V', 'vi'] },
  { id: 'half', name: 'Demi-cadence', degrees: ['V'] },
];

// Vérifie si "degrees" se TERMINE DÉJÀ par la séquence d'UNE cadence (ses N
// derniers degrés correspondent EXACTEMENT, dans le même ordre, aux N
// degrés de cette cadence) — utilisé avant d'ajouter une nouvelle cadence,
// pour détecter s'il faut avertir l'utilisateur (voir ResultScreen).
// Renvoie la 1re cadence trouvée (voir l'ordre de CADENCES ci-dessus) ou
// null si "degrees" ne se termine par aucune des 4.
export function findExistingCadence(degrees: string[]): Cadence | null {
  return (
    CADENCES.find((cadence) => {
      if (degrees.length < cadence.degrees.length) return false;
      const tail = degrees.slice(-cadence.degrees.length);
      return tail.every((degree, index) => degree === cadence.degrees[index]);
    }) ?? null
  );
}

// Retire, en fin de "degrees", exactement les N derniers degrés correspondant
// à la longueur de "cadence" — utilisé par withCadence pour retirer une
// cadence détectée (findExistingCadence) avant d'en ajouter une nouvelle
// par-dessus.
function withoutCadence(degrees: string[], cadence: Cadence): string[] {
  return degrees.slice(0, degrees.length - cadence.degrees.length);
}

// Ajoute la cadence "cadenceId" en fin de "degrees", en repartant TOUJOURS de
// "degrees" tel quel (jamais d'un état intermédiaire mémorisé quelque part) :
// si "degrees" se termine déjà par une cadence (la sienne ou une autre), on
// la retire d'abord (withoutCadence) avant d'ajouter la nouvelle — ce qui
// REMPLACE la fin plutôt que d'empiler 2 cadences à la suite. Repartir de
// "degrees" à chaque appel (plutôt que de mémoriser un état "avec cadence")
// est aussi ce qui rend l'opération RÉVERSIBLE : cadenceId === null renvoie
// "degrees" totalement inchangé, sans aucune trace résiduelle d'un ajout
// précédent.
export function withCadence(degrees: string[], cadenceId: string | null): string[] {
  if (cadenceId === null) return degrees;

  const cadence = CADENCES.find((item) => item.id === cadenceId);
  if (!cadence) return degrees;

  const existing = findExistingCadence(degrees);
  const baseDegrees = existing ? withoutCadence(degrees, existing) : degrees;
  return [...baseDegrees, ...cadence.degrees];
}
