import { Text, useColorScheme, View } from 'react-native';

/** UI kit gallery — owned by 1C (replace this file). Dev builds only. */
export default function Gallery() {
  const dark = useColorScheme() === 'dark';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#111315' : '#F7F6F2' }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 17, color: dark ? '#ECEDEE' : '#1A1C1E' }}>
        UI kit gallery (1C)
      </Text>
    </View>
  );
}
