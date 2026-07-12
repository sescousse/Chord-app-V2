// Change these values to adjust text styles across the whole app.
import { colors } from './colors'
import type { TextStyle } from 'react-native';
import { spacing } from './spacing';   // si card en a besoin
import { radius } from './spacing';    // si card en a besoin

export const fontSize = {
  sm: 13,
  md: 15,
  lg: 17,
  xl: 24,
  xxl: 32,
  xxxl: 42,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const textStyle = {
  fontSize: fontSize.md,
  fontWeight: fontWeight.regular,
}

export const title = {
  fontSize: fontSize.xl,
  fontWeight: fontWeight.semibold,
  color: colors.text,
}

export const subtitle = {
  fontSize: fontSize.md,
  color: colors.textMuted,
  textAlign: 'center' as const,
}

export const progressionText: TextStyle = {
  fontSize: fontSize.xxxl,
  fontWeight: fontWeight.bold,
  color: colors.text,
}
export const  cardTitle: TextStyle = {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  };

export const card: TextStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backGroundExercice,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    // Pas d'épaisseur de bordure définie dans le thème : voir le message ci-contre.
    borderWidth: 1,
    borderColor: colors.border,
}