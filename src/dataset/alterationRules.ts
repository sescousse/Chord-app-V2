// Qualité de la 7e diatonique d'un accord (voir DIATONIC_SEVENTH_SUFFIX dans
// chordUtils.ts) : la façon la plus fiable de désigner "quel TYPE d'accord"
// une règle concerne, indépendamment du degré/de la gamme qui l'a produit
// (ex: un accord "maj7" peut venir du Ier degré en gamme majeure OU du
// IIIème degré en gamme mineure — une règle sur les accords majeurs doit
// s'appliquer aux DEUX, pas à un degré précis).
export type ChordQuality = 'maj7' | 'm7' | '7' | 'm7b5';

// Degrés d'extension sur lesquels une règle peut porter.
export type AlterableDegree = 9 | 11 | 13;

// ─────────────────────────────────────────────────────────────────────────
// FORMAT D'UNE RÈGLE D'ALTÉRATION
// ─────────────────────────────────────────────────────────────────────────
// Chaque règle décrit UNE altération idiomatique : elle remplace une
// extension diatonique "brute" (ex: la 11e juste) par sa version altérée
// usuelle en musique (ex: la 11e augmentée, notée ♯11), pour un TYPE
// d'accord donné, à partir d'un certain niveau d'enrichissement.
//
// Champs :
// - id               : identifiant court et unique de la règle (ex:
//                       "sharp11-major"). Sert juste au débogage/à la
//                       lisibilité, jamais lu pour la logique elle-même.
// - appliesToQuality  : le TYPE d'accord concerné (voir ChordQuality
//                       ci-dessus). Ex: 'maj7' = accord majeur.
// - minLevel          : le niveau d'enrichissement MINIMUM à partir duquel
//                       la règle s'applique (ex: 11 → s'applique aux
//                       niveaux 11e ET 13e, qui contiennent tous les deux
//                       la 11e dans l'escalier diatonique de cette app —
//                       "à partir de", pas "exactement").
// - extensionDegree   : quel degré la règle modifie (9, 11 ou 13).
// - semitoneShift     : l'altération elle-même, en demi-tons (+1 = dièse,
//                       -1 = bémol). Appliquée à la note DIATONIQUE brute
//                       de ce degré (voir applyAlteration dans
//                       chordUtils.ts, qui lit ce champ).
// - alteredLabel      : le libellé de la pastille de fonction une fois
//                       l'altération appliquée (ex: "♯11"), affiché sur le
//                       clavier à la place du label diatonique brut ("11").
// - chordNameSuffix   : le nom (racine + suffixe) affiché quand la règle
//                       s'applique (ex: "maj7♯11"), en notation idiomatique
//                       standard — remplace le nom "brut" habituel de cette
//                       app (ex: "Cmaj11").
// - explanation       : le texte pédagogique affiché sous le clavier quand
//                       la règle est active.
//
// POUR AJOUTER UNE RÈGLE PLUS TARD (ex: ♭9 sur dominante, ♭13...) : il
// suffit d'ajouter une nouvelle entrée à ALTERATION_RULES ci-dessous, avec
// les champs appropriés. AUCUN changement n'est nécessaire dans
// chordUtils.ts ni improResult.tsx, qui lisent la table de façon générique
// (voir findAlterationRule dans chordUtils.ts, qui cherche simplement la
// 1ère règle dont appliesToQuality/minLevel correspondent).
export type AlterationRule = {
  id: string;
  appliesToQuality: ChordQuality;
  minLevel: AlterableDegree;
  extensionDegree: AlterableDegree;
  semitoneShift: 1 | -1;
  alteredLabel: string;
  chordNameSuffix: string;
  explanation: string;
};

export const ALTERATION_RULES: AlterationRule[] = [
  {
    id: 'sharp11-major',
    appliesToQuality: 'maj7',
    minLevel: 11,
    extensionDegree: 11,
    semitoneShift: 1,
    alteredLabel: '♯11',
    chordNameSuffix: 'maj7♯11',
    explanation:
      "La 11e juste frotte avec la tierce majeure. On la hausse d'un demi-ton (♯11) pour obtenir le son lydien : brillant et flottant, sans dissonance.",
  },
];
