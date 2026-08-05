// Change these values to re-theme the whole app.
//
// PALETTE "TWILIGHT" (test) — une seule famille de fond/surface/accent
// principal (violet-indigo profond, monochromatique background → surface →
// primary, du plus sombre au plus lumineux) plutôt que le fond neutre brun-
// gris + carte violet vif sans rapport de l'ancienne palette. Deux familles
// d'accent secondaires distinctes s'y ajoutent : un teal froid (exercice,
// à l'opposé du violet sur le cercle chromatique — bonne distinction visuelle
// pour "exercice/défi") et une famille chaude ambre/orange/or (backGroundExercice,
// streakAccent, achievementUnlocked — récompense/accroche, volontairement
// chaude pour trancher avec le violet froid dominant). Tous les tons de fond
// sont assez sombres pour que "text" (quasi blanc) et le blanc en dur utilisé
// ailleurs dans l'app restent lisibles PARTOUT où ils sont posés dessus
// (background, surface, primary, exercice, backGroundExercice, streakAccent,
// locked) : c'est la contrainte qui a guidé le choix de chaque valeur.
export const colors = {
  // Fond d'écran de base : indigo quasi noir (pas un gris/brun neutre) pour
  // ancrer la teinte violette dès la couche la plus basse.
  background: '#181423',
  // Fond "carte/surface élevée" : même famille que background, juste plus
  // clair — se lit comme une élévation naturelle du fond (façon Material
  // dark theme), alors que l'ancien "surface" (violet vif) tranchait
  // complètement avec le fond au lieu d'en être une variante.
  surface: '#241E36',
  // Texte principal : blanc cassé à peine teinté de violet (pas un blanc
  // clinique) — contraste élevé sur background/surface/primary (~14–16:1 et
  // ~5:1 respectivement), les 3 fonds sur lesquels il atterrit le plus souvent.
  text: '#F1EEF9',
  // Texte secondaire : gris-lavande (même famille que "text", pas un gris
  // neutre plat) — contraste ~5–6:1 sur background ET surface.
  textMuted: '#9C93B5',
  // Accent principal : violet vif, même teinte que background/surface mais
  // beaucoup plus clair/saturé — sert aussi de FOND (boutons, états actifs)
  // avec du texte clair par-dessus (~5:1), d'où un ton assez profond plutôt
  // qu'un violet pastel qui écraserait ce contraste.
  primary: '#7C3AED',
  // Séparateurs/bordures : violet-ardoise sombre, légèrement plus clair que
  // surface pour qu'un liseré reste perceptible sur les 2 fonds sombres
  // (contrairement à un noir pur, qui se fondrait presque entièrement dans
  // les deux) — reste aussi un bon séparateur sombre sur les touches
  // blanches du piano (fond blanc en dur, PianoChord.tsx), qui n'ont pas
  // besoin d'un violet clair pour rester lisibles.
  border: '#3D3555',
  // Accent "exercice/défi" : teal profond, à l'opposé du violet sur le
  // cercle chromatique — se distingue immédiatement du reste de la palette
  // (boss du parcours, pastille de basse du piano...) tout en gardant un bon
  // contraste avec du texte clair par-dessus (~5:1).
  exercice: 'rgb(15, 118, 110)',
  // Second accent de "carte" (lignes de CoursesScreen/ExercisesScreen,
  // pastille "quinte" du piano...) : ambre profond — démarre la famille
  // chaude (avec streakAccent et achievementUnlocked ci-dessous), distincte
  // du teal "exercice" et du violet "primary".
  backGroundExercice: '#B45309',
  // Gris neutre (légèrement teinté lavande pour rester dans la famille de
  // "textMuted") pour tout élément "verrouillé/désactivé" (ex: les étapes
  // verrouillées de CourseParcoursScreen) : assez clair pour rester lisible
  // en texte sur fond sombre, assez neutre pour lire "inactif" une fois en
  // fond (ex: pastille de succès verrouillé).
  locked: '#8B8698',
  // Rouge du liseré décoratif tout en haut du clavier de PianoChord (comme
  // le feutre rouge d'un vrai piano) : un rouge-rose profond, dans la même
  // famille chaude que streakAccent/achievementUnlocked sans s'y confondre.
  pianoStrip: '#E11D48',
  // Accent "flamme" du bloc streak de HomeScreen : orange chaud, toujours le
  // ton le plus "détonnant" de la palette face au violet froid dominant —
  // assombri par rapport à un orange pur pour garder un bon contraste sous
  // le texte blanc du bloc streak (~5:1).
  streakAccent: '#C2410C',
  // Fond de la pastille icône des succès DÉBLOQUÉS (écran Profil) : or,
  // dernier ton de la famille chaude — le cas "verrouillé" réutilise
  // toujours "locked" ci-dessus, pas besoin d'un second token pour ce sens.
  achievementUnlocked: '#F59E0B',
  // Texte d'erreur des formulaires (écrans d'auth) : rouge "universel" pour
  // ce sens précis, volontairement indépendant de la famille chaude
  // ambre/orange/or ci-dessus (backGroundExercice/streakAccent/
  // achievementUnlocked) pour ne pas se confondre avec elle — comme
  // shadowColor ailleurs dans l'app, ce n'est pas vraiment un choix de
  // TEINTE de marque mais une convention d'interface (rouge = erreur).
  danger: '#DC2626',
};

// Style de la barre de navigation du bas (tab bar). Un ton encore plus
// sombre que "background" (comme avant, où elle était quasi noire) : la
// chrome du bas doit rester en retrait par rapport au contenu, teintée
// violet ici plutôt que neutre pour rester dans la même famille que le
// reste de la palette.
export const tabBar = {
  backgroundColor: '#100D18',
  borderTopColor: colors.border,
};
