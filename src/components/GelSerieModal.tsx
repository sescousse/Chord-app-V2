import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { useProfile } from '../context/ProfileContext';

// TODO: illustration du gel de série — icône flocon générique en attendant
// un vrai visuel dédié. Exportée : réutilisée telle quelle par le header
// d'accueil (voir HomeScreen.tsx) et ici en grand — une seule source, pas 2
// emojis à faire évoluer séparément le jour où le vrai visuel arrive.
export const GEL_SERIE_ICON = '❄️';

// PRIX PROVISOIRE, ajustable — le seul endroit à modifier pour changer le
// coût d'un gel de série.
const PRIX_GEL = 50;

type GelSerieModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

// MODALE "Gel de série" — ouverte depuis l'icône gel du header d'accueil
// (voir HomeScreen.tsx). Pas de Animated ici (contrairement à SlidePanel/
// SettingsDrawer) : pas demandé pour cette modale, un simple "return null
// tant que fermée" suffit, même principe que SuccesCelebrationOverlay.tsx
// pour un overlay sans animation d'entrée/sortie.
export function GelSerieModal({ isOpen, onClose }: GelSerieModalProps) {
  const { profil, depenserJetons, ajouterJetons, ajouterGelsSerie } = useProfile();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  // "…" tant que le profil n'est pas chargé (ne devrait pas arriver en
  // pratique : le header qui ouvre cette modale affiche déjà le profil
  // chargé à ce moment-là) — même repli que le reste de l'app plutôt qu'un
  // chiffre inventé.
  const gelsDisplay = profil ? String(profil.gels_serie) : '…';

  // --- ACHAT D'UN GEL DE SÉRIE ------------------------------------------
  // ANTI-INCOHÉRENCE ("les deux ensemble, ou rien") — séquencé en 2 temps,
  // JAMAIS en parallèle :
  //
  // 1) DÉBIT D'ABORD. depenserJetons() vérifie déjà le solde AVANT d'écrire
  //    quoi que ce soit (voir son commentaire dans ProfileContext.tsx) : si
  //    le solde est insuffisant, elle renvoie une erreur SANS AVOIR RIEN
  //    ÉCRIT — on s'arrête alors ICI, avant même de songer à ajouter un
  //    gel. C'est ce qui garantit qu'un gel n'est JAMAIS ajouté sans avoir
  //    été payé.
  //
  // 2) INCRÉMENT ENSUITE, SEULEMENT SI le débit a réussi. Si CETTE 2e étape
  //    échoue (ex: coupure réseau pile entre les 2 appels — rare, mais
  //    possible avec 2 requêtes séparées, pas une vraie transaction
  //    serveur), les jetons auraient été débités sans contrepartie : on
  //    tente alors un REMBOURSEMENT (ajouterJetons du même montant) pour
  //    revenir à l'état de départ. Ce remboursement n'est pas garanti à
  //    100% non plus (même limite de non-atomicité que le reste de
  //    ProfileContext, ex: addXp) — mais couvre le cas normal (panne du 2e
  //    appel seul), qui est très largement le plus probable des deux.
  //
  // Une vraie garantie inconditionnelle demanderait une fonction SQL
  // (RPC) faisant les 2 écritures dans UNE SEULE transaction côté serveur
  // — hors périmètre ici (même choix déjà fait pour addXp/ajouterJetons).
  const handleAcheter = async () => {
    if (isPurchasing) return;

    setErrorMessage(null);
    setIsPurchasing(true);

    const depense = await depenserJetons(PRIX_GEL);
    if (depense.error) {
      setErrorMessage(
        depense.error === 'Solde de jetons insuffisant.' ? 'Pas assez de jetons.' : depense.error,
      );
      // TODO: proposer d'acheter des jetons (boutique de jetons) quand le
      // solde est insuffisant, plutôt que de simplement bloquer l'achat ici.
      setIsPurchasing(false);
      return;
    }

    const ajout = await ajouterGelsSerie(1);
    if (ajout.error) {
      // Remboursement (voir le commentaire détaillé ci-dessus) : les jetons
      // déjà débités reviennent, pour ne pas laisser l'utilisateur payé
      // sans rien en échange.
      await ajouterJetons(PRIX_GEL);
      setErrorMessage('Achat impossible, réessaie.');
      setIsPurchasing(false);
      return;
    }

    setIsPurchasing(false);
  };

  return (
    <View style={styles.overlayContainer}>
      {/* Fond assombri : un tap dessus ferme la modale — même convention que
          SuccesCelebrationOverlay.tsx. */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Carte elle-même Pressable (onPress = onClose) : un tap sur une zone
          VIDE de la carte ferme aussi la modale, mais le bouton "Acheter"
          et le bouton ✕ ci-dessous, étant leurs propres Pressable imbriqués,
          absorbent leur propre tap et ne remontent jamais jusqu'ici — même
          principe que SlidePanel.tsx. */}
      <Pressable style={styles.card} onPress={onClose}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonLabel}>✕</Text>
        </Pressable>

        <Text style={styles.bigIcon}>{GEL_SERIE_ICON}</Text>
        <Text style={styles.count}>{gelsDisplay}</Text>
        <Text style={styles.countLabel}>gel{profil && profil.gels_serie > 1 ? 's' : ''} de série</Text>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Pressable
          style={[styles.buyButton, isPurchasing && styles.buyButtonDisabled]}
          onPress={handleAcheter}
          disabled={isPurchasing}
        >
          <Text style={styles.buyButtonLabel}>
            {isPurchasing ? 'Achat…' : `Acheter — ${PRIX_GEL} jetons`}
          </Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Positionnée en absolute pour couvrir tout l'écran d'accueil (HomeScreen,
  // seul appelant) — zIndex/elevation élevés pour rester au-dessus de la
  // bande streak/gels/jetons, de la bannière et du contenu, comme les autres
  // overlays de l'app (SuccesCelebrationOverlay, SettingsDrawer).
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    zIndex: 500,
    elevation: 500,
  },
  // Même remarque que SuccesCelebrationOverlay.tsx : noir semi-transparent
  // en dur, convention d'assombrissement universelle indépendante de la
  // palette.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
  },
  closeButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  closeButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // "GROS" comme demandé : le plus grand corps de texte du thème, doublé
  // (même convention que le placeholder personnage de ProfileScreen.tsx).
  bigIcon: {
    fontSize: theme.text.size.xxxl * 2,
  },
  count: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  countLabel: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  // Pas de token "bouton primaire" dans le thème (déjà signalé ailleurs, ex:
  // LessonCourseScreen/ImproIntroScreen) : composé à partir des tokens
  // couleur/espacement/rayon existants.
  buyButton: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  buyButtonDisabled: {
    opacity: 0.6,
  },
  buyButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
