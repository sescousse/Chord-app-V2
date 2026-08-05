// Change these values to re-theme the whole app.
export const colors = {
  background: '#34312e',
  surface: '#a345e1',
  text: '#fcfcfc',
  textMuted: '#6B6B6F',
  primary: '#7400c1',
  border: '#000000',
  exercice: 'rgb(14, 14, 13)',
  backGroundExercice: '#a345e1',
  // Gris neutre pour tout élément "verrouillé/désactivé" (ex: les étapes
  // verrouillées de CourseParcoursScreen) : ni "border" ni "textMuted" ne
  // conviennent ici, tous deux réutilisés pour d'autres usages (contours,
  // texte secondaire) et pas pensés comme couleur de remplissage neutre.
  locked: '#A6A6AC',
  // Rouge du liseré décoratif tout en haut du clavier de PianoChord (comme
  // le feutre rouge d'un vrai piano). Nouveau token plutôt qu'une
  // réutilisation de "exercice" : ce dernier n'est de toute façon plus rouge
  // (c'est désormais un doré/moutarde, voir ci-dessus) et porte en plus sa
  // propre sémantique (accent "exercice"), sans rapport avec ce détail
  // décoratif du clavier.
  pianoStrip: '#C41E3A',
  // Accent "flamme" du bloc streak de HomeScreen : un orange chaud,
  // volontairement DÉTONNANT avec le reste de la palette (dominée par des
  // violets froids, voir "surface"/"primary" ci-dessus) — la carte streak
  // doit être l'accroche visuelle la plus forte de la page, aucun autre
  // token existant (surface/primary/exercice...) n'a cette fonction "carte
  // héros qui doit sauter aux yeux".
  streakAccent: '#FF6B35',
  // Fond de la pastille icône des succès DÉBLOQUÉS (écran Profil) : doré,
  // la teinte "trophée/récompense" attendue pour ce genre de badge — aucun
  // token existant n'a cette connotation (primary/exercice/streakAccent
  // portent chacun leur propre sémantique, sans rapport avec "récompense").
  // Le cas "verrouillé" n'a PAS besoin d'un second token : il réutilise
  // "locked" ci-dessus, déjà pensé pour "verrouillé/désactivé" en général.
  achievementUnlocked: '#FFC107',
};

// Style de la barre de navigation du bas (tab bar).
export const tabBar = {
  backgroundColor: '#0b0a0a',
  borderTopColor: colors.border,
};

