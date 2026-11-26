import { Redirect } from 'expo-router';
import {
  BookOpen,
  Columns2,
  FileText,
  House,
  KeyRound,
  ListOrdered,
  Moon,
  Plus,
  Printer,
  Settings,
  Share2,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { palettes, ThemeProvider, TYPE_NAMES, useTheme, type ColorKey, type ThemePreference, type TypeKey } from '@/theme';
import {
  AppBar,
  ApplicantRow,
  B,
  Banner,
  BigOption,
  Button,
  type ButtonState,
  type ButtonVariant,
  Card,
  Checkbox,
  Chip,
  ChoicePills,
  CompareTable,
  ConfirmDialog,
  CriterionRow,
  DateField,
  DialogCard,
  DocThumb,
  EmptyState,
  EvidenceTag,
  FormProgress,
  Hero,
  IconButton,
  IssueItem,
  IssuesCard,
  KeyValue,
  LargeTitle,
  LegalFooter,
  ListGroup,
  ListRow,
  Logo,
  LogoMark,
  ModeBar,
  MoneyField,
  OptionCard,
  PageDots,
  QueueNumber,
  RentalCard,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  SheetSurface,
  showSnackbar,
  SignaturePad,
  StatusBadge,
  Stepper,
  SummaryCard,
  Switch,
  SwitchRow,
  TabIcon,
  TextButton,
  TextField,
  TimerChip,
  Txt,
  Wordmark,
} from '@/ui';

/**
 * UI kit gallery (dev builds only): every component of the v2 Indigo mockup's Components page and the parts repeated
 * on its screens, in every state, light / dark (switch at the top). Sample data = product.md §8.
 */
export default function GalleryRoute() {
  const [pref, setPref] = useState<ThemePreference>('light');
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ThemeProvider preference={pref}>
      <Gallery pref={pref} setPref={setPref} />
    </ThemeProvider>
  );
}

const THEME_CHOICES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

function Gallery({ pref, setPref }: { pref: ThemePreference; setPref: (p: ThemePreference) => void }) {
  return (
    <Screen header={<AppBar title="UI kit gallery" subtitle="v2 Indigo · dev only" />}>
      <Segmented options={THEME_CHOICES} value={pref} onChange={setPref} accessibilityLabel="Theme" />
      <BrandSection />
      <TypeSection />
      <ColorSection />
      <BadgeSection />
      <ResultSection />
      <ButtonSection />
      <ControlSection />
      <FieldSection />
      <BannerSection />
      <ListSection />
      <CompareSection />
      <OverlaySection />
      <SignatureSection />
      <EmptySection />
      <NavSection />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function Cap({ children }: { children: string }) {
  return (
    <Txt style={{ fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 }} color="inkMuted">
      {children}
    </Txt>
  );
}

function Wrap({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'center' }}>{children}</View>;
}

// ---------------------------------------------------------------- brand / type / colour

function BrandSection() {
  const { colors } = useTheme();
  return (
    <Section title="Logo">
      <Logo height={40} />
      <Wrap gap={16}>
        <LogoMark size={56} />
        <LogoMark size={48} variant="mono" />
        <LogoMark size={48} variant="mono" color={colors.ink} />
        <Wordmark height={28} />
      </Wrap>
    </Section>
  );
}

const TYPE_SAMPLES: Record<TypeKey, string> = {
  display: 'Pick tenants the same way, every time.',
  title1: '1428 Maple St, Unit B',
  title2: 'Ready to decide',
  body: 'Set your criteria once. Check every applicant against them.',
  bodyStrong: 'Jordan Ellis',
  callout: 'Household income $5,400/mo is 3.27× rent',
  label: 'Monthly rent',
  caption: 'Received Dec 2, 9:14 AM',
  badge: 'Needs review',
  figure: '3.24×',
};

function TypeSection() {
  return (
    <Section title="Type (Inter)">
      {TYPE_NAMES.map((n) => {
        const key = n.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as TypeKey;
        return (
          <View key={n}>
            <Cap>{n}</Cap>
            <Txt variant={key}>{TYPE_SAMPLES[key]}</Txt>
          </View>
        );
      })}
    </Section>
  );
}

function ColorSection() {
  const { colors, scheme } = useTheme();
  const keys = Object.keys(palettes[scheme]) as ColorKey[];
  return (
    <Section title="Colour tokens">
      <Wrap>
        {keys.map((k) => (
          <View key={k} style={{ width: 96, gap: 4 }}>
            <View style={{ height: 36, borderRadius: 8, backgroundColor: colors[k], borderWidth: 1, borderColor: colors.line }} />
            <Txt variant="caption" color="inkMuted" numberOfLines={1}>
              {k}
            </Txt>
          </View>
        ))}
      </Wrap>
    </Section>
  );
}

// ---------------------------------------------------------------- badges / results

function BadgeSection() {
  return (
    <Section title="Status badge">
      <Cap>Outcome</Cap>
      <Wrap>
        <StatusBadge outcome="met" />
        <StatusBadge outcome="not_met" />
        <StatusBadge outcome="missing" />
        <StatusBadge outcome="needs_review" />
        <StatusBadge outcome="not_reviewed" />
      </Wrap>
      <Cap>Evidence</Cap>
      <Wrap gap={12}>
        <EvidenceTag evidence="verified" />
        <EvidenceTag evidence="claimed" />
        <EvidenceTag evidence="mismatch" />
      </Wrap>
      <Cap>Large (200 % card)</Cap>
      <StatusBadge outcome="needs_review" large />
      <Cap>Chips · timers · queue</Cap>
      <Wrap>
        <Chip label="Open" tone="accent" dot />
        <Chip label="Offer out" tone="warn" dot />
        <Chip label="Leased" dot />
        <Chip label="Closed" tone="outline" />
        <Chip label="Compare" tone="outline" icon={Columns2} />
        <Chip label="First-come" tone="outline" icon={ListOrdered} />
        <Chip label="Selected" tone="solid" />
        <Chip label="In review" size="sm" />
      </Wrap>
      <TimerChip label="Missing info — 41 h left" />
      <TimerChip label="Offer — 22 h left" calm />
      <Wrap>
        <QueueNumber n={1} />
        <QueueNumber n={2} active />
        <QueueNumber n={3} />
      </Wrap>
    </Section>
  );
}

function ResultSection() {
  return (
    <Section title="Criterion row · summary · issues">
      <ListGroup>
        <CriterionRow
          name="Income ≥ 3.0× rent"
          outcome="met"
          evidence="verified"
          reason={
            <>
              <B>$5,351.67/mo</B> is <B>3.24×</B> rent
            </>
          }
          onPress={() => {}}
        />
        <CriterionRow
          name="Income ≥ 3.0× rent"
          outcome="not_met"
          evidence="claimed"
          reason={
            <>
              <B>$4,700/mo</B> is <B>2.85×</B> rent; required 3.0× · Short by $250/mo
            </>
          }
          onPress={() => {}}
        />
        <CriterionRow name="12 months rental history" outcome="met" evidence="mismatch" reason="Dates differ from landlord by more than 31 days" onPress={() => {}} />
        <CriterionRow name="Landlord would rent again" outcome="missing" reason="Unreachable after 3 attempts" onPress={() => {}} />
        <CriterionRow name="Criminal history" outcome="needs_review" reason="Individual review after a conditional offer" />
      </ListGroup>
      <SummaryCard ready title="Ready to decide" subtitle="Not a score. Same criteria for every applicant." />
      <SummaryCard ready={false} title="3 items missing" subtitle="Not a score. Same criteria for every applicant." />
      <IssuesCard title="3 things to check">
        <IssueItem evidence="mismatch" title="Rent differs by +29%" detail="Said $1,200 · landlord says $1,550" />
        <IssueItem outcome="not_met" title="Income 2.85× rent" detail="Short by $250/mo · Claimed" action={{ label: 'Add pay stubs', onPress: () => {} }} />
        <IssueItem outcome="missing" title="Landlord reference" detail="2 attempts, no answer" action={{ label: 'Call landlord', onPress: () => {} }} />
      </IssuesCard>
    </Section>
  );
}

// ---------------------------------------------------------------- buttons / controls / fields

const VARIANTS: { v: ButtonVariant; label: string }[] = [
  { v: 'primary', label: 'Save decision' },
  { v: 'secondary', label: 'Share criteria' },
  { v: 'tonal', label: 'Compare applicants · 4' },
  { v: 'ghost', label: 'Try a sample rental' },
  { v: 'danger', label: 'Delete' },
  { v: 'dangerOutline', label: 'Delete their data' },
];
const STATES: ButtonState[] = ['default', 'pressed', 'focused', 'disabled', 'loading'];

function ButtonSection() {
  return (
    <Section title="Button × 5 states">
      {VARIANTS.map(({ v, label }) => (
        <View key={v} style={{ gap: 8 }}>
          <Cap>{`${v} · ${v === 'primary' ? 52 : 48}`}</Cap>
          {STATES.map((s) => (
            <Button
              key={s}
              block
              variant={v}
              state={s}
              label={s === 'default' ? label : `${label} — ${s}`}
              loadingLabel="Saving…"
              icon={v === 'secondary' ? Share2 : v === 'tonal' ? Columns2 : v === 'dangerOutline' ? Trash2 : undefined}
              onPress={() => showSnackbar({ message: `${label} pressed` })}
            />
          ))}
        </View>
      ))}
      <Cap>Small (40) · icon button · text button</Cap>
      <Wrap>
        <Button size="sm" variant="secondary" label="Edit" onPress={() => {}} />
        <Button size="sm" variant="tonal" label="Call" onPress={() => {}} />
        <Button size="sm" label="Add" icon={Plus} onPress={() => {}} />
      </Wrap>
      <Wrap>
        <IconButton icon={Share2} accessibilityLabel="Share" onPress={() => {}} />
        <IconButton icon={Plus} tone="accent" accessibilityLabel="Add" onPress={() => {}} />
        <IconButton icon={Plus} tone="filled" accessibilityLabel="New rental" onPress={() => {}} />
        <IconButton icon={Trash2} accessibilityLabel="Delete" disabled />
        <TextButton label="Edit criteria" onPress={() => {}} />
        <TextButton label="Remove" tone="danger" onPress={() => {}} />
        <TextButton label="Skip" tone="muted" onPress={() => {}} />
      </Wrap>
    </Section>
  );
}

function ControlSection() {
  const [mode, setMode] = useState<'compare' | 'first'>('compare');
  const [res, setRes] = useState<string | null>('rent');
  const [pets, setPets] = useState<string[]>(['dog']);
  const [on, setOn] = useState(true);
  const [ratio, setRatio] = useState(30);
  const [agree, setAgree] = useState(true);
  const [opt, setOpt] = useState('a');
  const [multi, setMulti] = useState(true);
  return (
    <Section title="Controls">
      <Cap>Segmented</Cap>
      <Segmented
        options={[
          { value: 'compare', label: 'Compare applicants' },
          { value: 'first', label: 'First-come order' },
        ]}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Review mode"
      />
      <Cap>Choice pills (one / several)</Cap>
      <ChoicePills
        options={[
          { value: 'rent', label: 'Rent' },
          { value: 'own', label: 'Own' },
          { value: 'family', label: 'With family' },
          { value: 'other', label: 'Other' },
        ]}
        value={res}
        onChange={setRes}
      />
      <ChoicePills
        options={[
          { value: 'dog', label: 'Dog' },
          { value: 'cat', label: 'Cat' },
          { value: 'none', label: 'No pets' },
        ]}
        values={pets}
        onToggle={(v, sel) => setPets((p) => (sel ? [...p, v] : p.filter((x) => x !== v)))}
      />
      <Cap>Toggle (on · off · disabled)</Cap>
      <Wrap gap={16}>
        <Switch value={on} onChange={setOn} accessibilityLabel="Toggle" />
        <Switch value={!on} onChange={(v) => setOn(!v)} accessibilityLabel="Toggle 2" />
        <Switch value disabled onChange={() => {}} accessibilityLabel="Disabled toggle" />
      </Wrap>
      <ListGroup>
        <SwitchRow title="Backup reminder" description="Remind me after 30 days without a backup" value={on} onChange={setOn} />
        <SwitchRow title="Timer alerts" value={false} onChange={() => {}} disabled />
      </ListGroup>
      <Cap>Stepper</Cap>
      <Stepper
        display={`${(ratio / 10).toFixed(1)}×`}
        onDecrement={() => setRatio((r) => Math.max(10, r - 1))}
        onIncrement={() => setRatio((r) => Math.min(50, r + 1))}
        canDecrement={ratio > 10}
        canIncrement={ratio < 50}
        accessibilityLabel="Income multiple"
      />
      <Cap>Checkbox</Cap>
      <Checkbox label="I understand Evenlease is not legal advice" value={agree} onChange={setAgree} />
      <Checkbox label="Unchecked option" value={false} onChange={() => {}} />
      <Cap>Option cards (radio · checkbox)</Cap>
      <View style={{ gap: 8 }}>
        <OptionCard title="Compare applicants" description="Review everyone, then choose." selected={opt === 'a'} onPress={() => setOpt('a')} />
        <OptionCard title="First-come order" description="Review in the order received; offer to the first who qualifies." selected={opt === 'b'} onPress={() => setOpt('b')} />
        <OptionCard kind="checkbox" title="Accept housing vouchers" description="Required by law in many places." selected={multi} onPress={() => setMulti((m) => !m)} />
        <OptionCard title="Disabled option" selected={false} onPress={() => {}} disabled />
      </View>
    </Section>
  );
}

function FieldSection() {
  const [rent, setRent] = useState<number | null>(165000);
  const [income, setIncome] = useState<number | null>(540000);
  const [date, setDate] = useState<string | null>('2026-12-02');
  const [name, setName] = useState('');
  return (
    <Section title="Form fields">
      <MoneyField label="Monthly rent" required cents={rent} onChangeCents={setRent} />
      <MoneyField label="Gross monthly income" help="Gross = before taxes." cents={income} onChangeCents={setIncome} state="focus" />
      <TextField label="ZIP" value="4321" error="ZIP must be 5 digits" keyboardType="number-pad" onChangeText={() => {}} />
      <TextField label="Full name" placeholder="As on photo ID" value={name} onChangeText={setName} />
      <TextField label="Notes" multiline value="Prefers a January move-in." onChangeText={() => {}} />
      <TextField label="Disabled" value="Locked value" disabled onChangeText={() => {}} />
      <TextField label="Rent share" suffix="%" value="50" keyboardType="number-pad" onChangeText={() => {}} />
      <DateField label="Move-in date" value={date} onChange={setDate} help="When the lease starts." />
      <DateField label="Date not set" value={null} onChange={setDate} required />
      <Cap>Form progress (7 parts)</Cap>
      <FormProgress current={1} title="Household" right="Saved" />
      <FormProgress current={6} title="Consent & signature" />
    </Section>
  );
}

// ---------------------------------------------------------------- banners / lists

function BannerSection() {
  return (
    <Section title="Banner · legal footer">
      <Banner tone="warn">In 23 states, DC and many cities, refusing or disadvantaging voucher holders is illegal.</Banner>
      <Banner tone="info" title="Criteria are locked because you have applicants." actions={[{ label: 'Edit criteria', onPress: () => {} }]}>
        Changes apply to everyone and are recorded.
      </Banner>
      <Banner tone="accent" icon={ListOrdered}>
        First-come order: review one at a time, in the order received.
      </Banner>
      <LegalFooter />
    </Section>
  );
}

function ListSection() {
  return (
    <Section title="Rental card · applicant rows · lists">
      <RentalCard
        address="1428 Maple St, Unit B"
        city="Columbus, OH 43215"
        status={{ label: 'Open', tone: 'accent' }}
        facts="$1,650/mo · 2 bd"
        mode={{ label: 'Compare', icon: Columns2 }}
        count="4 applicants"
        highlight="1 ready to decide"
        onPress={() => {}}
      />
      <ListGroup>
        <ApplicantRow name="Jordan Ellis" status="In review" received="Received Dec 2, 9:14 AM" summary="Ready to decide" summaryReady onPress={() => {}} />
        <ApplicantRow name="Priya Raman" status="Conditional offer" received="Received Dec 2, 2:40 PM" summary="2 items missing" onPress={() => {}} />
        <ApplicantRow name="Lena Park" status="In review" received="Dec 1, 9:40 AM" summary="1 item missing" queue={{ n: 2, active: true }} onPress={() => {}} />
      </ListGroup>
      <ListGroup>
        <ListRow icon={Moon} title="Appearance" value="System" onPress={() => {}} />
        <ListRow icon={KeyRound} iconTone="accent" title="App lock" subtitle="Fingerprint or phone PIN" onPress={() => {}} />
        <ListRow icon={FileText} title="Decision file" subtitle="PDF of criteria, results and decisions" right={<Chip label="PDF" size="sm" />} />
        <ListRow icon={Trash2} title="Delete all data" danger onPress={() => {}} />
      </ListGroup>
      <Card>
        <Txt variant="title2">Screening report</Txt>
        <KeyValue label="Credit score" value="712" />
        <KeyValue label="Collections" value="$0.00" />
        <KeyValue label="Report date" value="Dec 3, 2026" />
      </Card>
      <Card variant="tint">
        <Txt variant="callout">Tint card (accent-soft).</Txt>
      </Card>
      <Wrap>
        <DocThumb label="Photo ID, page 1" checked />
        <DocThumb label="Pay stub" />
        <DocThumb label="Add photo" add onPress={() => {}} />
      </Wrap>
    </Section>
  );
}

function CompareSection() {
  const cols = [
    { key: 'je', title: 'Jordan E.', subtitle: 'Dec 2, 9:14' },
    { key: 'pr', title: 'Priya R.', subtitle: 'Dec 2, 2:40' },
    { key: 'mw', title: 'Marcus W.', subtitle: 'Dec 3, 8:05' },
  ];
  const rows = [
    {
      key: 'inc',
      label: 'Income ≥ 3.0×',
      cells: {
        je: { outcome: 'met' as const, evidence: 'verified' as const },
        pr: { outcome: 'not_met' as const, evidence: 'claimed' as const },
        mw: { outcome: 'met' as const, evidence: 'mismatch' as const },
      },
    },
    {
      key: 'll',
      label: 'Landlord ref.',
      cells: {
        je: { outcome: 'met' as const, evidence: 'verified' as const },
        pr: { outcome: 'missing' as const },
        mw: { outcome: 'needs_review' as const },
      },
    },
    { key: 'iss', label: 'Issues', bold: true, cells: { je: { text: '0' }, pr: { text: '4', tone: 'warn' as const }, mw: { text: '1', tone: 'warn' as const } } },
  ];
  return (
    <Section title="Compare table (cards from 130 % text)">
      <CompareTable cornerLabel="Criteria" columns={cols} rows={rows} cards={false} />
      <CompareTable cornerLabel="Criteria" columns={cols.slice(0, 1)} rows={rows} cards />
    </Section>
  );
}

// ---------------------------------------------------------------- overlays

function OverlaySection() {
  const { colors, radius } = useTheme();
  const [sheet, setSheet] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Sheet · dialog · snackbar">
      <View style={{ height: 380, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface0, justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim }} />
        <SheetSurface title="Add applicant" onClose={() => {}}>
          <BigOption icon={FileText} title="Enter an application" description="Type it in from Zillow, email or a paper form." onPress={() => {}} />
          <BigOption icon={Smartphone} title="Hand the phone to the applicant" description="They fill it in and sign." onPress={() => {}} />
          <BigOption icon={Printer} title="Paper form" description="Print a blank application." onPress={() => {}} />
        </SheetSurface>
      </View>
      <SwitchRow title="Sheet has unsaved changes" description="Closing asks “Discard changes?”" value={dirty} onChange={setDirty} />
      <Button variant="secondary" block label="Open sheet" onPress={() => setSheet(true)} />
      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Why are you changing criteria?"
        dirty={dirty}
        footer={<Button block label="Save" onPress={() => setSheet(false)} />}
      >
        <TextField label="Reason" multiline value={dirty ? 'Lower income multiple to 2.5×' : ''} onChangeText={() => setDirty(true)} />
        <Banner tone="info">The change and the reason are recorded for every applicant.</Banner>
      </Sheet>

      <View style={{ height: 330, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.scrim, justifyContent: 'center', padding: 24 }}>
        <DialogCard title="Permanently delete data for 3 applicants?" body="This can't be undone." confirmLabel="Delete" onCancel={() => {}} onConfirm={() => {}} />
      </View>
      <DialogCard tone="warn" title="Discard changes?" cancelLabel="Keep editing" confirmLabel="Discard" destructive onCancel={() => {}} onConfirm={() => {}} />
      <DialogCard tone="accent" glyph="shieldCheck" title="Make a conditional offer?" body="Background review unlocks after the offer." confirmLabel="Make offer" onCancel={() => {}} onConfirm={() => {}} />
      <Button variant="danger" block label="Open delete dialog" onPress={() => setDialog(true)} />
      <ConfirmDialog
        visible={dialog}
        title="Permanently delete data for 3 applicants?"
        body="This can't be undone."
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setDialog(false)}
        onConfirm={() => {
          setBusy(true);
          setTimeout(() => {
            setBusy(false);
            setDialog(false);
            showSnackbar({ message: 'Deleted data for 3 applicants' });
          }, 1200);
        }}
      />
      <Button
        variant="tonal"
        block
        label="Show snackbar with Undo"
        onPress={() =>
          showSnackbar({
            message: 'Applicant archived',
            actionLabel: 'Undo',
            onAction: () => showSnackbar({ message: 'Restored' }),
          })
        }
      />
    </Section>
  );
}

function SignatureSection() {
  const [signed, setSigned] = useState(false);
  return (
    <Section title="Signature pad">
      <SignaturePad label="Applicant signature" onChange={(v) => setSigned(!!v)} />
      <Txt variant="caption" color="inkMuted">
        {signed ? 'Signed' : 'Not signed'}
      </Txt>
    </Section>
  );
}

function EmptySection() {
  return (
    <Section title="Empty state">
      <EmptyState
        icon={House}
        title="No rentals yet"
        body="Add your first rental to set criteria and start reviewing applicants."
        primary={{ label: 'New rental', onPress: () => {} }}
        secondary={{ label: 'Try a sample rental', onPress: () => {} }}
        style={{ paddingTop: 12 }}
      />
    </Section>
  );
}

function NavSection() {
  const { colors, radius } = useTheme();
  return (
    <Section title="Headers · mode bar · tab bar · dots">
      <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.surface0 }}>
        <AppBar title="Applicant" subtitle="1428 Maple St, Unit B" onBack={() => {}} right={<IconButton icon={Share2} accessibilityLabel="Share" />} />
        <LargeTitle title="Rentals" right={<IconButton icon={Plus} tone="filled" accessibilityLabel="New rental" />} />
        <View style={{ padding: 16 }}>
          <Hero title="Jordan Ellis" meta="Received Dec 2, 9:14 AM · Typed in">
            <Chip label="In review" />
            <StatusBadge outcome="met" />
          </Hero>
        </View>
      </View>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
        <ModeBar title="Applicant mode" actionLabel="Landlord" onAction={() => {}} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          height: 64,
          backgroundColor: colors.surface1,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.line,
          overflow: 'hidden',
        }}
      >
        {[
          { icon: House, label: 'Rentals', on: true },
          { icon: BookOpen, label: 'Guide', on: false },
          { icon: Settings, label: 'Settings', on: false },
        ].map((tab) => (
          <View key={tab.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <TabIcon icon={tab.icon} focused={tab.on} color={tab.on ? colors.accent : colors.inkMuted} />
            <Txt
              style={{ fontFamily: tab.on ? 'Inter_600SemiBold' : 'Inter_500Medium', fontSize: 12, lineHeight: 16 }}
              color={tab.on ? 'accent' : 'inkMuted'}
            >
              {tab.label}
            </Txt>
          </View>
        ))}
      </View>
      <PageDots count={3} current={1} />
    </Section>
  );
}
