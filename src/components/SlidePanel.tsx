import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { theme } from '../theme';

// Le panneau couvre environ les 3/4 hauts de l'écran, laissant le 1/4 bas
// visible ET cliquable (ex: d'autres boutons de l'écran appelant, qui ne
// doivent jamais être recouverts ni interceptés).
const SLIDE_PANEL_HEIGHT_RATIO = 0.75;

type SlidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

// Panneau glissant RÉUTILISABLE, ancré en haut de l'écran, pleine largeur.
//
// POURQUOI PAS LE COMPOSANT Modal DE REACT NATIVE : Modal impose une
// présentation "fenêtre" gérée par le système d'exploitation lui-même (une
// vraie fenêtre native séparée de la hiérarchie de vues de l'écran
// appelant), pensée pour occuper soit tout l'écran, soit une carte centrée
// dessus — il n'existe pas de façon de lui dire "seulement les 3/4 hauts,
// ancré en haut, le reste de l'écran doit rester dans la même hiérarchie et
// répondre normalement au toucher". Un simple Animated.View en position
// 'absolute', lui, s'intègre directement dans la mise en page de l'écran
// appelant (un enfant de plus dans son arbre React) : il peut donc coexister
// avec le reste du contenu (ex: les autres boutons de l'écran, jamais
// recouverts par une fenêtre séparée) et adopter n'importe quelle
// forme/taille/position, puisque c'est juste une View comme une autre.
//
// STRUCTURE RÉUTILISABLE : ce composant ne fournit que le "chargement"
// commun aux 3 panneaux qui l'utilisent (accompagnement/voicing/
// enrichissement, voir improResult.tsx) — le glissement animé, la carte
// pleine largeur/hauteur fixe avec coins arrondis en bas, le bouton fermer,
// et une zone de contenu défilante. Chaque appelant fournit SON PROPRE
// contenu via "children" (titre, onglets/flèches, boutons...), qui reste
// donc entièrement le sien : SlidePanel ne connaît rien du V/V, des
// accompagnements ou des voicings.
//
// TOUJOURS MONTÉ pendant que l'écran appelant existe (isOpen pilote sa
// VISIBILITÉ, pas son montage) : nécessaire pour que la FERMETURE soit
// ANIMÉE (le panneau remonte hors champ) plutôt que de disparaître
// instantanément — si ce composant démontait dès la fermeture, React
// retirerait l'Animated.View de l'arbre avant que l'animation de sortie ait
// eu le temps de jouer.
//
// IMPORTANT (timers) : parce que SlidePanel reste TOUJOURS monté, "children"
// reste TOUJOURS monté lui aussi tant que l'appelant le passe en prop — un
// contenu qui lance un minuteur (ex: le séquenceur d'arpège de
// AccompanimentPanelContent) DOIT donc lui-même arrêter ce minuteur quand
// "isOpen" repasse à false, sous peine de le laisser tourner indéfiniment en
// arrière-plan une fois le panneau "fermé" (juste glissé hors champ). Ce
// n'est PAS la responsabilité de SlidePanel (qui ne sait rien du contenu
// qu'on lui passe) : voir le commentaire sur ce point dans chaque contenu
// concerné, côté improResult.tsx.
export function SlidePanel({ isOpen, onClose, children }: SlidePanelProps) {
  // Hauteur du panneau recalculée à chaque rendu à partir de la fenêtre
  // RÉELLE (useWindowDimensions, déjà utilisé ailleurs dans l'app pour du
  // responsive, ex: PianoChord), plutôt qu'une valeur fixe en dur.
  const { height: windowHeight } = useWindowDimensions();
  const panelHeight = windowHeight * SLIDE_PANEL_HEIGHT_RATIO;

  // ANIMATION DE GLISSEMENT (translateY) : un Animated.Value plutôt qu'un
  // state React classique — Animated l'anime frame par frame (ici via le
  // driver natif) sans repasser par un re-render à chaque étape. Valeur
  // INITIALE : -panelHeight, le panneau entièrement au-dessus de l'écran,
  // hors champ — cohérent avec "isOpen" qui démarre à false chez tous les
  // appelants actuels. useRef garde la MÊME instance entre les rendus (un
  // useState en recréerait une nouvelle, donc une nouvelle animation, à
  // chaque render).
  //
  // STRUCTURE PRÉVUE POUR LE SWIPE (pas implémenté maintenant, périmètre
  // strict de cette tâche) : translateY étant déjà un Animated.Value
  // autonome (pas dérivé d'un state React), un futur geste (PanResponder ou
  // gesture-handler) pourra le piloter DIRECTEMENT pendant le drag
  // (translateY.setValue(...) ou Animated.event) puis, au relâchement, soit
  // animer jusqu'à 0 (le geste n'allait pas assez loin pour fermer), soit
  // jusqu'à -panelHeight PUIS appeler onClose() — exactement ce que fait déjà
  // le bouton ✕ / le tap sur une zone vide du panneau ci-dessous. La
  // fermeture resterait donc la MÊME fonction (onClose), réutilisable telle
  // quelle par un futur geste, sans rien changer ici.
  const translateY = useRef(new Animated.Value(-panelHeight)).current;

  // OUVERTURE/FERMETURE : anime translateY vers 0 (ouvert) ou -panelHeight
  // (fermé) à chaque changement de "isOpen".
  //
  // Dépend UNIQUEMENT de "isOpen" (pas de panelHeight, qui ne change qu'en
  // cas de rotation de l'écran) : une rotation pendant que le panneau est
  // fermé/ouvert ne doit pas relancer une animation toute seule — seul un
  // VRAI changement d'ouverture/fermeture doit le faire.
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOpen ? 0 : -panelHeight,
      // Réglages choisis pour atterrir dans les ~300-400ms demandés tout en
      // restant "dynamique" (léger effet ressort), plutôt qu'un mouvement
      // linéaire/mécanique.
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, translateY]);

  return (
    <Animated.View
      style={[styles.container, { height: panelHeight, transform: [{ translateY }] }]}
      // Hors champ (fermé, ou en train de se fermer) : ignore les touches,
      // pour ne jamais intercepter un tap destiné au contenu réellement
      // visible en dessous (ex: les boutons de l'écran appelant) pendant que
      // le panneau est invisible.
      pointerEvents={isOpen ? 'auto' : 'none'}
    >
      {/* UN SEUL Pressable, opaque, occupant TOUTE la largeur ET hauteur du
          panneau — pas de fond assombri séparé + carte centrée plus petite
          (comme le faisaient les anciennes Modal) : inutile ici, le panneau
          est déjà opaque et couvre exactement toute sa zone, rien à
          assombrir en dessous. Ce Pressable ferme le panneau au tap : un tap
          sur un enfant interactif (bouton, onglet... dans "children" ou le
          bouton fermer ci-dessous) est absorbé par CET enfant et ne remonte
          donc jamais jusqu'ici (comportement standard des Pressable
          imbriqués de React Native) — seul un tap sur une zone VIDE du
          panneau le ferme donc réellement. */}
      <Pressable style={styles.card} onPress={onClose}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonLabel}>✕</Text>
        </Pressable>

        {/* Le panneau a une hauteur FIXE (panelHeight, ~75% de l'écran) : le
            contenu doit donc pouvoir défiler À L'INTÉRIEUR si besoin,
            plutôt que de déborder du panneau ou d'être coupé. */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {children}
        </ScrollView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // Coins arrondis SEULEMENT en bas (le haut touche le bord de l'écran,
  // comme demandé) : theme.radius.xl, le rayon le plus prononcé du thème,
  // pour un vrai effet "panneau" plutôt qu'une simple carte. Fond =
  // theme.colors.surface (couleur "carte" du thème), comme demandé.
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  closeButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    margin: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  closeButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
});
