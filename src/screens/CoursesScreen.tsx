import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import type { CourseStackParamList } from '../navigation/CourseStack';

type CoursesScreenNavigationProp = NativeStackNavigationProp<CourseStackParamList, 'CoursesList'>;
// a ajouter quand course satck sera pret
type Course = {
  id: string;
  title: string;
  accentColor: string;
  screen?: keyof CourseStackParamList;
}
const COURSES: Course[] = [
  {
    id: 'Degrés',
    title: 'Degrés',
    accentColor: theme.colors.primary,
    screen: 'Degrés',
  },
  {
    id: 'Gammes',
    title: 'Gammes',
    accentColor: theme.colors.primary,
    screen: 'Gammes',
  },
];

export default function CoursesScreen() {
  const navigation = useNavigation<CoursesScreenNavigationProp>();
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Cours</Text>
      <View style={styles.list}>
        {COURSES.map((course) => (
          <Pressable key={course.id} style={theme.card} onPress={() => {
              if (course.screen) {
                navigation.navigate(course.screen);
              } else {
                console.log(course.title);
              }
            }}
            >
            <View style={[styles.accentDot, { backgroundColor: course.accentColor }]} />
            <Text style={theme.cardTitle}>{course.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
   list: {
    gap: theme.spacing.md,
  },
  accentDot: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.radius.xl,
  },
});
