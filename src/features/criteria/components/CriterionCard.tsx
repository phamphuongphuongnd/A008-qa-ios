/**
 * S-04 criterion card (mockup v2 `.el-cb`): code tile, title + help, on/off switch, inline parameters, warnings.
 * Driven by `CriterionCardModel` (screenModels.ts); every change goes back as a reducer action.
 */
import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { CriteriaWarningCode, DocType, PetPolicy } from '@/engine';
import { GUIDE } from '@/features/guide/articles';
import { t } from '@/i18n';
import { routes } from '@/routes';
import { font, useTheme } from '@/theme';
import { Banner, ChoicePills, Glyph, IconButton, Stepper, Switch, TextButton, TextField, Txt } from '@/ui';

import type { CriteriaEditorAction } from '../criteriaEditor';
import type { CriterionCardModel } from '../screenModels';

/** Guide articles linked from S-04 (2E's S-25a content). C4 "Why this matters" → checking references / fake landlords. */
export const GUIDE_SLUGS = { fairCriteria: GUIDE.fairCriteria, landlordReference: GUIDE.fakeReferences } as const;

export function CriterionCard({
  card,
  editable,
  dispatch,
  onDismissWarning,
}: {
  card: CriterionCardModel;
  editable: boolean;
  dispatch: (a: CriteriaEditorAction) => void;
  onDismissWarning: (code: CriteriaWarningCode) => void;
}) {
  const { colors, radius } = useTheme();
  const muted = !card.enabled;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.code, { backgroundColor: card.enabled ? colors.accentSoft : colors.surface2, borderRadius: radius.sm }]}>
          <Txt style={[font(700, 12, 16), { color: card.enabled ? colors.accent : colors.inkMuted }]}>{card.codeLabel}</Txt>
        </View>
        <View style={styles.name}>
          <Txt style={[font(600, 15, 20), { color: muted ? colors.inkMuted : colors.ink }]}>{card.title}</Txt>
          {card.guideLink ? (
            <View style={styles.link}>
              <TextButton label={t('units:s04.whyThisMatters')} onPress={() => router.push(routes.guideArticle(GUIDE_SLUGS.landlordReference))} />
            </View>
          ) : (
            <Txt variant="caption" color="inkMuted">
              {card.help}
            </Txt>
          )}
        </View>
        {card.custom && editable ? (
          <IconButton
            icon={Trash2}
            accessibilityLabel={t('units:s04.customA11yRemove', { title: card.title })}
            onPress={() => dispatch({ type: 'removeCustom', id: card.id })}
          />
        ) : null}
        <Switch
          value={card.enabled}
          disabled={!editable}
          onChange={(enabled) => dispatch({ type: 'toggle', id: card.id, enabled })}
          accessibilityLabel={t('units:s04.toggleA11y', { code: card.codeLabel, title: card.title })}
        />
      </View>

      {card.params.map((p, i) => {
        switch (p.kind) {
          case 'stepper':
            return (
              <View key={i} style={styles.param}>
                <Txt style={[font(400, 14, 20), styles.paramLabel, { color: colors.inkMuted }]}>{p.label}</Txt>
                <Stepper
                  display={p.display}
                  canDecrement={p.canDecrement}
                  canIncrement={p.canIncrement}
                  onDecrement={() => dispatch({ type: 'step', id: card.id, delta: -1 })}
                  onIncrement={() => dispatch({ type: 'step', id: card.id, delta: 1 })}
                  accessibilityLabel={p.a11y}
                />
              </View>
            );
          case 'voucherShare':
            return (
              <View key={i} style={styles.param}>
                <Txt style={[font(400, 14, 20), styles.paramLabel, { color: colors.inkMuted }]}>{p.label}</Txt>
                <Switch value={p.value} onChange={(on) => dispatch({ type: 'setVoucherShare', id: card.id, on })} accessibilityLabel={p.label} />
              </View>
            );
          case 'petPolicy':
            return (
              <View key={i} style={styles.block}>
                <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{p.label}</Txt>
                <ChoicePills<PetPolicy>
                  options={p.options}
                  value={p.value}
                  onChange={(policy) => dispatch({ type: 'setPetPolicy', id: card.id, policy })}
                  accessibilityLabel={p.label}
                />
              </View>
            );
          case 'documents':
            return (
              <View key={i} style={styles.block}>
                <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{p.label}</Txt>
                <ChoicePills<DocType>
                  options={p.options}
                  values={p.options.filter((o) => o.selected).map((o) => o.value)}
                  onToggle={(doc, on) => dispatch({ type: 'toggleDocument', id: card.id, doc, on })}
                  accessibilityLabel={p.label}
                />
                {p.otherLabel !== null ? (
                  <TextField
                    label={t('units:s04.params.otherDocument')}
                    value={p.otherLabel}
                    maxLength={60}
                    onChangeText={(label) => dispatch({ type: 'setOtherDocument', id: card.id, label })}
                  />
                ) : null}
              </View>
            );
        }
      })}

      {card.error ? (
        <View style={styles.err} accessibilityLiveRegion="polite">
          <Glyph name="alertCircle" size={16} color={colors.danger} />
          <Txt style={[font(500, 13, 18), { color: colors.danger, flex: 1 }]}>{card.error}</Txt>
        </View>
      ) : null}

      {card.warnings.map((w) =>
        w.code === 'occupancy_below_two' ? (
          <Banner
            key={w.code}
            tone="warn"
            actions={
              editable
                ? [
                    { label: t('units:s04.occupancyWarning.setTo2'), onPress: () => dispatch({ type: 'setNumber', id: card.id, value: 2 }) },
                    { label: t('units:s04.occupancyWarning.keep', { count: 1 }), onPress: () => onDismissWarning(w.code) },
                  ]
                : undefined
            }
          >
            {t('units:s04.occupancyWarning.body')}
          </Banner>
        ) : w.code === 'voucher_off' ? (
          <Banner key={w.code} tone="warn">
            {w.message}
          </Banner>
        ) : (
          <Banner key={w.code} tone="info">
            {w.message}
          </Banner>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  code: { minWidth: 36, height: 28, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, minWidth: 0, gap: 2 },
  link: { alignSelf: 'flex-start' },
  param: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  paramLabel: { flexShrink: 1, flexBasis: 140, flexGrow: 1 },
  block: { gap: 8 },
  err: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
