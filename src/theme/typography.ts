// Change these values to adjust text styles across the whole app.
import { colors } from './colors'
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