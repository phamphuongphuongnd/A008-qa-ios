import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { palettes, ThemeProvider, useTheme, type ColorName, type Scheme } from '@/theme';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  Clock,
  Columns3,
  ConfirmDialog,
  CriterionRow,
  DateField,
  DialogActions,
  DialogCard,
  Divider,
  Ellipsis,
  EmptyState,
  EvidenceTag,
  Fab,
  FormProgress,
  IconButton,
  Key,
  KeyValue,
  LegalNote,
  List,
  ListRow,
  MoneyField,
  OptionChips,
  OutcomeBadge,
  PageDots,
  Plus,
  RadioGroup,
  Screen,
  ScreenHeader,
  SectionLabel,
  Segmented,
  Sheet,
  SheetPreview,
  SignaturePad,
  SnackbarView,
  Switch,
  TextField,
  Thumb,
  Txt,
  User,
  useSnackbar,
  type Signature,
} from '@/ui';

/**
 * UI kit gallery (dev builds only): every component of src/ui in every state, as in design/screens/Components.dc.html.
 * The switch at the top forces Light / Dark for the whole page.
 */
export default function Gallery() {
  const [scheme, setScheme] = useState<Scheme>(useTheme().scheme);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ThemeProvider preference={scheme}>
      <Screen
        header={
          <ScreenHeader
            title="UI kit"
            subtitle="Every component and state. Not a score."
            actions={
              <View style={{ width: 150 }}>
                <Segmented label="Theme" value={scheme} onChange={setScheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
              </View>
            }
          />
        }>
        <Content />
      </Screen>
    </ThemeProvider>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </Card>
  );
}

const Row = ({ children, gap = 8 }: { children: ReactNode; gap?: number }) => <View style={[styles.row, { gap }]}>{children}</View>;

const SWATCHES: [string, ColorName][] = [
  ['Background', 'bg'],
  ['Surface', 'surface'],
  ['Surface 2', 'surface2'],
  ['Border', 'border'],
  ['Text', 'text'],
  ['Text 2', 'text2'],
  ['Accent', 'accent'],
  ['Accent soft', 'accentSoft'],
  ['Warning', 'warning'],
  ['Warning soft', 'warningSoft'],
  ['Danger', 'danger'],
  ['Danger soft', 'dangerSoft'],
];

function Content() {
  const { colors, scheme } = useTheme();
  const snack = useSnackbar();
  const [name, setName] = useState('Marcus Webb');
  const [zip, setZip] = useState('4321');
  const [notes, setNotes] = useState('');
  const [rent, setRent] = useState<number | null>(165000);
  const [day, setDay] = useState<string | null>('2027-01-01');
  const [month, setMonth] = useState<string | null>(null);
  const [sw, setSw] = useState(true);
  const [cb, setCb] = useState(true);
  const [mode, setMode] = useState<'compare' | 'first_come'>('compare');
  const [answer, setAnswer] = useState<string | null>('yes');
  const [decision, setDecision] = useState<string | null>('deny');
  const [freq, setFreq] = useState<string | null>('biweekly');
  const [sig, setSig] = useState<Signature | null>(null);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);

  return (
    <>
      <Block title="Color tokens">
        <View style={styles.grid}>
          {SWATCHES.map(([label, key]) => (
            <View key={key} style={styles.swatch}>
              <View style={[styles.chipColor, { backgroundColor: colors[key], borderColor: colors.border }]} />
              <Txt v="small" weight="semibold">
                {label}
              </Txt>
              <Txt v="hint">{palettes[scheme][key]}</Txt>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Type">
        <Txt v="title">Title 28 / 700</Txt>
        <Txt v="heading">Heading 21 / 650</Txt>
        <Txt v="subhead">Subhead 17 / 600</Txt>
        <Txt>Body 15 / 400 — Same criteria for every applicant.</Txt>
        <Txt v="secondary">Secondary 14 / 400</Txt>
        <Txt v="caption">Caption 12 / 650 caps</Txt>
        <Txt num weight="bold" style={{ fontSize: 20, lineHeight: 26 }}>
          $5,351.67 · 3.24×
        </Txt>
      </Block>

      <Block title="Buttons · Default · Pressed · Focused · Disabled · Loading">
        <Row>
          <Button label="Save" />
          <Button label="Save" demoState="pressed" />
          <Button label="Save" demoState="focused" />
          <Button label="Save" disabled />
          <Button label="Save" loading />
        </Row>
        <Row>
          <Button variant="secondary" label="Secondary" />
          <Button variant="text" label="Text" />
          <Button variant="danger" label="Delete" />
          <Button variant="small" label="Small" />
        </Row>
        <Row>
          <Button variant="smallOutline" tone="warning" label="Back up" />
          <Button variant="smallSurface" label="Call landlord" />
          <Button variant="primary" icon={Plus} label="New rental" />
        </Row>
        <Row>
          <IconButton icon={Ellipsis} label="More actions" />
          <IconButton icon={Plus} label="New rental" filled />
          <Fab label="Add applicant" />
        </Row>
        <Button block label="Make a decision" />
      </Block>

      <Block title="Criterion result (never a score)">
        <Row>
          <OutcomeBadge outcome="met" />
          <OutcomeBadge outcome="not_met" />
          <OutcomeBadge outcome="missing" />
          <OutcomeBadge outcome="needs_review" />
          <OutcomeBadge outcome="not_reviewed" />
        </Row>
        <SectionLabel>Evidence</SectionLabel>
        <Row gap={14}>
          <EvidenceTag evidence="verified" />
          <EvidenceTag evidence="claimed" />
          <EvidenceTag evidence="mismatch" />
        </Row>
        <SectionLabel>Chips</SectionLabel>
        <Row gap={6}>
          <Chip label="Compare" icon={Columns3} />
          <Chip label="First-come" icon={List} />
          <Chip label="Open" tone="accent" />
          <Chip label="Offer out" tone="warning" />
          <Chip label="Denied" tone="danger" />
          <Chip label="Sample" />
        </Row>
      </Block>

      <Block title="Criteria list">
        <View>
          <CriterionRow name="Income: at least 3.0× the rent" reason="$5,351.67/mo is 3.24× rent" outcome="met" evidence="verified" />
          <CriterionRow name="Rental history: 12 months" reason="Landlord says Jan 2023 – now; application says Mar 2022 – now" outcome="met" evidence="mismatch" />
          <CriterionRow name="Previous landlord would rent again" reason="Landlord: “Wouldn't say”" outcome="needs_review" evidence="verified" />
          <CriterionRow name="No unpaid balance owed to a past landlord" reason="$2,310 · source: screening report" outcome="not_met" evidence="verified" />
          <CriterionRow name="Required documents" reason="Proof of income" outcome="missing" />
          <CriterionRow name="Criminal history review" reason="Not reviewed yet (after offer)" outcome="not_reviewed" last />
        </View>
      </Block>

      <Block title="Inputs · default · focused · error">
        <TextField label="Full legal name" value={name} onChangeText={setName} />
        <TextField label="ZIP" value={zip} onChangeText={setZip} demoFocused inputProps={{ keyboardType: 'number-pad' }} />
        <TextField label="ZIP" value={zip} onChangeText={setZip} error="ZIP must be 5 digits" inputProps={{ keyboardType: 'number-pad' }} />
        <MoneyField label="Monthly rent" value={rent} onChange={setRent} unit="/mo" hint="Gross = before taxes." />
        <MoneyField label="Security deposit" value={null} onChange={() => {}} error="Enter the monthly rent" />
        <DateField label="Available from" value={day} onChange={setDay} />
        <DateField label="From" mode="month" value={month} onChange={setMonth} clearable placeholder="Month / year" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={80} placeholder="e.g. what the applicant could do differently" />
        <TextField label="Disabled" value="Locked after you save" onChangeText={() => {}} disabled />
      </Block>

      <Block title="Controls">
        <Switch label="Apply to tenant's share" hint="When a housing voucher pays part of the rent" value={sw} onChange={setSw} />
        <Switch label="Off" value={false} onChange={() => {}} />
        <Switch label="Disabled" value onChange={() => {}} disabled />
        <Checkbox label="I certify the information in this application is true and complete." checked={cb} onChange={setCb} />
        <Checkbox label="Unchecked" checked={false} onChange={() => {}} />
        <RadioGroup
          label="Pay frequency"
          value={freq}
          onChange={setFreq}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Every 2 weeks' },
          ]}
        />
        <Segmented
          label="Review mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'compare', label: 'Compare applicants' },
            { value: 'first_come', label: 'First-come order' },
          ]}
        />
        <OptionChips
          label="Would you rent to them again?"
          value={answer}
          onChange={setAnswer}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'wouldnt_say', label: "Wouldn't say" },
          ]}
        />
        <OptionChips
          label="Decision"
          value={decision}
          onChange={setDecision}
          toneOf={(v) => (v === 'deny' ? 'danger' : 'accent')}
          options={[
            { value: 'conditional_offer', label: 'Conditional offer' },
            { value: 'approve', label: 'Approve' },
            { value: 'approve_with_conditions', label: 'Approve with conditions' },
            { value: 'deny', label: 'Deny' },
          ]}
        />
      </Block>

      <Block title="Banners">
        <Banner tone="warning" title="Back up your data" body="Last backup 34 days ago" action={<Button variant="smallOutline" tone="warning" label="Back up" />} />
        <Banner tone="warning" body="Warning banner — orange never blocks." />
        <Banner tone="danger" body="Error banner — red only for errors and delete." />
        <Banner tone="accent" title="Criteria are locked" body="Changes apply to everyone and are recorded." />
        <Banner tone="neutral" body="1 closed rental still holds data for 3 applicants not selected." />
        <LegalNote />
      </Block>

      <Block title="Cards and rows">
        <Card onPress={() => {}} accessibilityLabel="1428 Maple St, Unit B. Open. 4 applicants, 2 ready to decide">
          <Row>
            <View style={{ flex: 1 }}>
              <Txt v="subhead">1428 Maple St, Unit B</Txt>
              <Txt v="secondary">Columbus, OH 43215</Txt>
            </View>
            <Chip label="Open" tone="accent" />
          </Row>
          <Txt num weight="semibold">
            $1,650/mo · 2 bd · Available Jan 1
          </Txt>
          <Row gap={6}>
            <Chip label="Compare" icon={Columns3} />
            <Chip label="Sample" />
          </Row>
          <Divider />
          <Row>
            <User size={16} color={colors.text2} />
            <Txt v="small" style={{ flex: 1 }}>
              4 applicants · <Txt v="small" weight="bold" c="accent">2 ready to decide</Txt>
            </Txt>
            <Clock size={16} color={colors.warning} />
          </Row>
        </Card>
        <Card flush>
          <ListRow leading={<Avatar name="Jordan Ellis" />} title="Jordan Ellis" subtitle="Received Dec 2, 9:14 AM" trailing={<Chip label="Ready" tone="accent" />} chevron onPress={() => {}} />
          <ListRow leading={<Avatar name="Priya Raman" />} title="Priya Raman" subtitle="Dec 2, 2:40 PM · 2 items missing" chevron onPress={() => {}} />
          <ListRow icon={Key} title="Move-in checklist" subtitle="Not started" chevron onPress={() => {}} last />
        </Card>
        <Card tone="warning">
          <SectionLabel color="warning">Issues · 2</SectionLabel>
          <ListRow title="Rent doesn't match" subtitle="Landlord: $1,550 · application: $1,200 (+29%)" trailing={<Button variant="smallSurface" label="Review" />} />
          <ListRow title="Proof of income missing" subtitle="Pay stubs, offer letter or benefits letter" trailing={<Button variant="smallSurface" label="Add" />} last />
        </Card>
        <KeyValue label="Gross pay per period" value="$2,470.00" />
        <KeyValue label="Monthly" value="≈ $5,351.67/mo" />
        <Row>
          <Thumb label="Photo ID, checked" onPress={() => {}} />
          <Thumb label="Pay stub 1" />
        </Row>
      </Block>

      <Block title="Header, progress, empty">
        <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.bg }]}>
          <ScreenHeader large title="Rentals" actions={<IconButton icon={Plus} label="New rental" filled />} />
        </View>
        <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.bg }]}>
          <ScreenHeader caption="Marcus Webb · 6 of 7" title="Consent & signature" onBack={() => {}} />
          <FormProgress step={6} total={7} />
        </View>
        <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.bg }]}>
          <ScreenHeader title="Marcus Webb" subtitle="Received Dec 3, 11:05 AM · 3 people" onBack={() => {}} actions={<IconButton icon={Ellipsis} label="More actions" />} />
        </View>
        <PageDots index={1} count={3} />
        <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.bg }]}>
          <EmptyState icon={Key} title="No rentals yet" body="Add your first rental to set criteria and start reviewing applicants.">
            <Button icon={Plus} label="New rental" />
            <Button variant="text" label="Try a sample rental" />
          </EmptyState>
        </View>
      </Block>

      <Block title="Signature">
        <SignaturePad label="Signature" value={sig} onChange={setSig} />
        <SignaturePad label="Tenant signature" value={null} onChange={() => {}} error="Sign to continue" />
      </Block>

      <Block title="Sheet · dialog · snackbar">
        <SheetPreview title="Decision">
          <Txt v="label">Reasons (required)</Txt>
          <Checkbox label="No unpaid balance owed to a past landlord" checked onChange={() => {}} />
          <Banner tone="warning" title="An adverse action notice is required" body="Federal law (FCRA) requires a written notice when a screening report plays any part in a denial." />
          <Button variant="danger" block label="Deny and create notice" />
          <LegalNote short />
        </SheetPreview>
        <DialogCard title="Permanently delete data for 3 applicants?" body="Their applications, photos, documents and reports will be erased from this phone. This can't be undone.">
          <DialogActions cancelLabel="Cancel" confirmLabel="Delete" destructive />
        </DialogCard>
        <SnackbarView message="Applicant deleted" actionLabel="Undo" />
        <Row>
          <Button variant="secondary" label="Open sheet" onPress={() => setSheet(true)} />
          <Button variant="secondary" label="Open dialog" onPress={() => setDialog(true)} />
          <Button variant="secondary" label="Snackbar" onPress={() => snack({ message: 'Applicant deleted', actionLabel: 'Undo', onAction: () => {} })} />
        </Row>
      </Block>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Add applicant" onCancel={() => setSheet(false)} dirty={notes.length > 0}>
        <ListRow icon={Plus} title="Enter an application" subtitle="Type it in from Zillow, email or a paper form." chevron onPress={() => setSheet(false)} />
        <ListRow icon={User} title="Hand the phone to the applicant" subtitle="They fill it in and sign. They can't see anything else." chevron onPress={() => setSheet(false)} />
        <TextField label="Notes (type to test “Discard changes?”)" value={notes} onChangeText={setNotes} />
      </Sheet>
      <ConfirmDialog
        visible={dialog}
        title="Permanently delete data for 3 applicants?"
        body="This can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDialog(false)}
        onConfirm={() => setDialog(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: '30%', minWidth: 90, gap: 2 },
  chipColor: { height: 36, borderRadius: 8, borderWidth: 1 },
  frame: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
});
