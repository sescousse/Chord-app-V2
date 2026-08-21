// Contenu du panneau "Choisis ta gamme" — premier écran du module "Les
// bases de l'improvisation" (voir la carte du même nom dans
// ExercisesScreen.tsx, onglet Apprendre). N'est QUE le contenu : le
// glissement, la carte, le bouton fermer et le défilement sont fournis par
// SlidePanel (voir son utilisation dans ExercisesScreen.tsx), même
// convention que AccompanimentPanelContent/VoicingPanelContent/
// EnrichmentPanelContent dans improResult.tsx.
//
// PÉRIMÈTRE STRICT : juste l'UI de sélection tonique + mode et l'activation
// du bouton "Démarre" — aucune logique musicale (pas de calcul de gamme, pas
// de tonal, pas d'audio). Au tap sur "Démarre", ce composant transmet
// simplement le choix fait (onDemarrer) — fermer le panneau et ouvrir la
// page-menu de la gamme (GammeMenuScreen) est la responsabilité
// d'ExercisesScreen, pas la sienne (voir le commentaire sur onDemarrer
// ci-dessous).
//
// Dropdown/TONIQUES/MODES sont EXPORTÉS : ReproduisAccordExercise.tsx les
// réutilise pour son propre contrôle "changer de gamme" — un widget
// purement présentationnel (aucune dépendance à isOpen/onDemarrer/ce
// composant), donc sans risque de coupler l'exercice à CE fichier au-delà
// du strict minimum.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type ChoisirGammeContentProps = {
  // Piloté par ExercisesScreen, ce composant reste TOUJOURS monté (enfant de
  // SlidePanel, voir son commentaire sur pourquoi) — "isOpen" sert ici à
  // réinitialiser tonique/mode/menus ouverts à l'ouverture, même principe
  // que EnrichmentPanelContent dans improResult.tsx.
  isOpen: boolean;
  // Appelé au tap sur "Démarre" (une fois actif) avec les 2 choix faits —
  // c'est ExercisesScreen qui décide quoi en faire (fermer le panneau ET
  // naviguer vers GammeMenuScreen), même répartition que
  // onAddCadence/onRemoveCadence pour EnrichmentPanelContent : ce composant
  // ne connaît ni la navigation, ni la pile Exercices, juste "l'utilisateur a
  // choisi tonique + mode".
  onDemarrer: (tonique: string, mode: string) => void;
};

// Exportés : réutilisés par ReproduisAccordExercise.tsx (contrôle "changer
// de gamme" depuis l'exercice) — mêmes 12/2 options, même widget, plutôt que
// de les dupliquer une 3e fois (une 1re duplication existe déjà, volontaire,
// pour FRENCH_TONIC_TO_PITCH_CLASS dans ce même exercice — voir son
// commentaire : ce tableau-LÀ traduit vers un format tonal, un besoin
// différent de la simple liste d'options ci-dessous).
export type DropdownOption = { value: string; label: string };

// Les 12 toniques en solfège français, dans l'ordre chromatique — tapées
// telles quelles (pas de logique musicale ici, voir le commentaire en haut
// de fichier) : "value" et "label" sont identiques.
export const TONIQUES: DropdownOption[] = [
  { value: 'Do', label: 'Do' },
  { value: 'Do#/Réb', label: 'Do#/Réb' },
  { value: 'Ré', label: 'Ré' },
  { value: 'Ré#/Mib', label: 'Ré#/Mib' },
  { value: 'Mi', label: 'Mi' },
  { value: 'Fa', label: 'Fa' },
  { value: 'Fa#/Solb', label: 'Fa#/Solb' },
  { value: 'Sol', label: 'Sol' },
  { value: 'Sol#/Lab', label: 'Sol#/Lab' },
  { value: 'La', label: 'La' },
  { value: 'La#/Sib', label: 'La#/Sib' },
  { value: 'Si', label: 'Si' },
];

// Seulement 2 pour l'instant (demande explicite) — mais un simple tableau
// suffit déjà à "prévoir la structure" pour en ajouter d'autres plus tard
// (ex: dorien, mineur harmonique...) : il suffirait d'ajouter une entrée
// ici, rien d'autre à changer. Valeurs 'majeur'/'mineur' : mêmes littéraux
// que ScaleChoice (chordUtils.ts) — coïncidence volontaire pour qu'une
// future brique qui brancherait ce choix sur le reste de l'app n'ait pas de
// table de correspondance à écrire, SANS importer ce type ici (pas de
// dépendance à chordUtils.ts dans ce fichier volontairement pur UI).
export const MODES: DropdownOption[] = [
  { value: 'majeur', label: 'majeur' },
  { value: 'mineur', label: 'mineur' },
];

// Hauteur max de la liste déroulée avant défilement interne — 12 toniques à
// ~44px chacune dépassent largement cette limite (rend le menu tonique
// RÉELLEMENT scrollable, comme demandé), 2 modes n'y arrivent jamais (aucun
// scroll visible pour ce menu-là, sans que ça pose de problème).
const DROPDOWN_LIST_MAX_HEIGHT = 220;

export type DropdownProps = {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

// Menu déroulant minimal : un champ Pressable (valeur choisie ou
// placeholder + chevron) qui, au tap, déplie une liste d'options en dessous
// (défilante si besoin) plutôt que de flotter par-dessus le reste — évite
// tout calcul de positionnement absolu par-dessus SlidePanel, qui a déjà sa
// propre ScrollView (le contenu se pousse simplement vers le bas quand un
// menu est ouvert, comportement standard d'un accordéon). Exporté (voir le
// commentaire sur TONIQUES/MODES) : ses styles restent définis DANS ce
// fichier (styles.dropdownXxx, plus bas) — un import depuis ailleurs les
// réutilise tels quels, sans rien avoir à passer en props.
export function Dropdown({ label, placeholder, options, value, isExpanded, onToggle, onSelect }: DropdownProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <View style={styles.dropdownBlock}>
      <Text style={styles.dropdownLabel}>{label}</Text>

      <Pressable style={styles.dropdownField} onPress={onToggle}>
        <Text style={selectedOption ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={styles.dropdownChevron}>{isExpanded ? '▲' : '▼'}</Text>
      </Pressable>

      {isExpanded && (
        // nestedScrollEnabled : cette liste défile À L'INTÉRIEUR de la
        // ScrollView fournie par SlidePanel (scroll vertical imbriqué) —
        // nécessaire sur Android pour que le geste de défilement soit
        // correctement capté par CETTE liste plutôt que remonter au parent.
        <ScrollView
          style={styles.dropdownOptionsScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={styles.dropdownOptionRow}
                onPress={() => onSelect(option.value)}
              >
                <Text style={[styles.dropdownOptionLabel, isSelected && styles.dropdownOptionLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export function ChoisirGammeContent({ isOpen, onDemarrer }: ChoisirGammeContentProps) {
  const [tonique, setTonique] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [isToniqueOuverte, setIsToniqueOuverte] = useState(false);
  const [isModeOuvert, setIsModeOuvert] = useState(false);

  // Réinitialise TOUT à l'ouverture (isOpen passant à true) : ce composant
  // reste toujours monté (enfant de SlidePanel), donc rien ne le ferait
  // sinon — même principe que EnrichmentPanelContent (voir son commentaire
  // dans improResult.tsx). Garantit "rien n'est présélectionné" à CHAQUE
  // ouverture, pas seulement au tout premier montage.
  useEffect(() => {
    if (isOpen) {
      setTonique(null);
      setMode(null);
      setIsToniqueOuverte(false);
      setIsModeOuvert(false);
    }
  }, [isOpen]);

  const peutDemarrer = tonique !== null && mode !== null;

  const handleDemarrer = () => {
    // tonique/mode sont non-null ici : le bouton est désactivé (disabled,
    // voir plus bas) tant que peutDemarrer est faux, donc onPress ne peut
    // pas être déclenché avant que les 2 soient choisis — mais le early
    // return reste utile en filet, la valeur non-null est réaffirmée juste
    // en dessous pour TypeScript (narrowing).
    if (!peutDemarrer || tonique === null || mode === null) return;
    onDemarrer(tonique, mode);
  };

  return (
    <>
      <Text style={theme.text.title}>Choisis ta gamme</Text>
      <Text style={styles.subtitle}>
        Pour improviser, on commence toujours par choisir une gamme.
      </Text>

      <Dropdown
        label="Tonique"
        placeholder="Ex : Do"
        options={TONIQUES}
        value={tonique}
        isExpanded={isToniqueOuverte}
        onToggle={() => {
          setIsToniqueOuverte((ouverte) => !ouverte);
          setIsModeOuvert(false);
        }}
        onSelect={(value) => {
          setTonique(value);
          setIsToniqueOuverte(false);
        }}
      />

      <Dropdown
        label="Mode"
        placeholder="Choisis un mode"
        options={MODES}
        value={mode}
        isExpanded={isModeOuvert}
        onToggle={() => {
          setIsModeOuvert((ouvert) => !ouvert);
          setIsToniqueOuverte(false);
        }}
        onSelect={(value) => {
          setMode(value);
          setIsModeOuvert(false);
        }}
      />

      <Pressable
        style={[styles.demarrerButton, !peutDemarrer && styles.demarrerButtonDisabled]}
        onPress={handleDemarrer}
        disabled={!peutDemarrer}
      >
        <Text style={styles.demarrerButtonLabel}>Démarre</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
  },
  dropdownBlock: {
    gap: theme.spacing.xs,
  },
  // Même recette que sectionLabel de HarmonyTestScreen.tsx (caption discrète
  // au-dessus d'un champ de sélection) : cohérence entre les 2 écrans de
  // test/sélection de l'app.
  dropdownLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  dropdownValue: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Couleur atténuée : distingue clairement un placeholder ("Ex : Do", texte
  // informatif) d'une vraie sélection — nécessaire ici car "Do" est aussi un
  // choix RÉEL possible, la seule couleur permet de ne jamais les confondre.
  dropdownPlaceholder: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
  },
  dropdownChevron: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  dropdownOptionsScroll: {
    maxHeight: DROPDOWN_LIST_MAX_HEIGHT,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dropdownOptionRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownOptionLabel: {
    fontSize: theme.text.size.md,
    color: theme.colors.text,
  },
  dropdownOptionLabelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.text.weight.semibold,
  },
  // Même recette que buyButton (GelSerieModal.tsx)/analyzeButton
  // (HarmonyTestScreen.tsx) : bouton primaire plein, atténué (opacity) tant
  // que désactivé plutôt qu'un style totalement différent — la même forme
  // reste reconnaissable, juste "éteinte".
  demarrerButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  demarrerButtonDisabled: {
    opacity: 0.5,
  },
  demarrerButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
