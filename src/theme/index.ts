import { colors, tabBar } from './colors';
import { radius, spacing } from './spacing';
import { fontSize, fontWeight, textStyle ,title ,subtitle} from './typography';

export const theme = {
  colors,
  tabBar,
  spacing,
  radius,
  text: {
    size: fontSize,
    weight: fontWeight,
    style: textStyle,
    title,
    subtitle,
  },
};

export { colors, tabBar, spacing, radius, fontSize, fontWeight, textStyle };
