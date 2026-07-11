// Change these values to adjust text styles across the whole app.
import { colors } from './colors'
import type { TextStyle } from 'react-native';
import { theme } from '../theme';
export const fontSize = {
  sm: 13,
  md: 15,
  lg: 17,
  xl: 24,
  xxl: 32,
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

export const  cardTitle: TextStyle = {
    flex: 1,
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  };

export const card: TextStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backGroundExercice,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    // Pas d'épaisseur de bordure définie dans le thème : voir le message ci-contre.
    borderWidth: 1,
    borderColor: theme.colors.border,
}