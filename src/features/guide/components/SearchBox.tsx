/** S-25 "Search articles" box (mockup: magnifier + placeholder in a field). */
import { Search, X } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { font, useTheme } from '@/theme';
import { IconButton } from '@/ui';

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface1, borderColor: colors.lineStrong, borderRadius: radius.md }]}>
      <Search size={20} color={colors.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t('guide:s25.search')}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={t('guide:s25.search')}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.input, font(400, 16, 22), { color: colors.ink }]}
      />
      {value ? <IconButton icon={X} accessibilityLabel={t('guide:s25.clear')} onPress={() => onChange('')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 12, paddingRight: 4, borderWidth: 1 },
  input: { flex: 1, paddingVertical: 10 },
});
