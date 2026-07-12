import { colors, tabBar } from './colors';
import { radius, spacing,} from './spacing';
import { fontSize, fontWeight, textStyle ,title ,subtitle,cardTitle,card, progressionText} from './typography';


export const theme = {
  colors,
  tabBar,
  spacing,
  radius,
  cardTitle,
  card,
  text: {
    size: fontSize,
    weight: fontWeight,
    style: textStyle,
    title,
    subtitle,
    progressionText,
  },
};

export { colors, tabBar, spacing, radius, fontSize, fontWeight, textStyle ,cardTitle, card};
