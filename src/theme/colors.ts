// Change these values to re-theme the whole app.
export const colors = {
  background: 'rgb(107, 73, 49)',
  surface: 'rgb(90, 44, 25)',
  text: '#ffffff',
  textMuted: '#6B6B6F',
  primary: '#de8406',
  border: '#000000',
  exercice: 'rgb(235, 177, 1)',
  backGroundExercice: 'rgb(128, 93, 42)',
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
};

// Style de la barre de navigation du bas (tab bar).
export const tabBar = {
  backgroundColor: '#93682f',
  borderTopColor: colors.border,
};

