# src/ui — UI kit v2 Indigo (owner 1D) · gallery `/dev/gallery` (dev builds)

Import from `@/ui`. Colours only via `useTheme()`. All controls have role / label; text wraps at 200 %; ≥ 48 touch — the pressable frame itself is 48 (`TOUCH_MIN`, ./touch.ts), a smaller look (IconButton 44, sm button 40, pill 40, segment 42) is drawn inside it; never `hitSlop` (TalkBack uses the frame) — B-75.

| Group | Components (main props) |
|---|---|
| Text / icons | `Txt` (variant, color, tabular, weight) · `Glyph` (mockup line icons: check, x, ring, bang, clock, shieldCheck, bubble, notEqual, scale, timer, alertCircle, trash, lock, queue) · other icons: lucide-react-native |
| Buttons | `Button` (label, variant primary 52 / secondary / tonal / ghost / danger / dangerOutline 48, size sm, icon, block, disabled, loading, loadingLabel, state = forced look) · `IconButton` (icon, accessibilityLabel, tone plain/accent/filled) · `TextButton` (tone accent/danger/muted) |
| Status | `StatusBadge` (outcome: engine `Outcome`, large) · `EvidenceTag` (evidence: engine `Evidence`, compact) · `Chip` (tone neutral/accent/warn/outline/solid, dot, icon, size sm) · `TimerChip` (label, calm) · `QueueNumber` (n, active) · `Avatar` (name) · `BadgeRow` |
| Cards / lists | `Card` (variant default/flush/tint, onPress) · `ListGroup` (auto inset dividers) · `ListRow` (title, subtitle, value, icon, iconTone, right, chevron, danger, onPress) · `SectionHeader` (title, meta, action; owns 8 below, no negative margin — B-41) · `KeyValue` · `Divider` |
| Screen parts | `CriterionRow` (name, outcome, evidence, reason with `<B>`) · `ApplicantRow` (name, status, received, summary, summaryReady, queue) · `RentalCard` (address, city, status{label,tone}, facts, mode{label,icon}, count, highlight) · `SummaryCard` (ready, title, subtitle) · `IssuesCard` + `IssueItem` (outcome/evidence, title, detail, action) · `CompareTable` (columns, rows, cornerLabel; cards from 130 % text) |
| Fields | `TextField` (label, required, help, error, prefix, suffix, multiline, disabled, ref) · `MoneyField` (cents, onChangeCents — integer cents, "1,650.00" on blur) · `DateField` (value 'YYYY-MM-DD', onChange, min/max) · `FieldShell` · pure `parseMoney / formatMoneyField` |
| Choices | `Segmented` (options, value, onChange; tick haptic) · `ChoicePills` (value or values+onToggle) · `Switch` · `SwitchRow` · `Checkbox` · `OptionCard` (kind radio/checkbox) · `Stepper` (display, onIncrement/onDecrement, adjustable) |
| Feedback | `Banner` (tone warn/info/accent, title, actions) · `LegalFooter` ("not legal advice") · `EmptyState` (icon, title, body, primary, secondary) · `FormProgress` (current 0-based, total 7, title) · `PageDots` · `DocThumb` |
| Overlays | `Sheet` (visible, onClose, title, footer, dirty → "Discard changes?") · `SheetSurface` · `BigOption` · `ConfirmDialog` (safe left, destructive red right; busy) · `DialogCard` · `DiscardDialog` · `useDiscardGuard(dirty)` for formSheet routes · `showSnackbar({message, actionLabel, onAction})` (5 s, longer with a screen reader) · `useSnackbarOffset(px)` · `SnackbarHost` (root) |
| Layout | `Screen` (header, footer, scroll, bottomInset; max width 600) · `AppBar` (title, subtitle, back, right) · `LargeTitle` · `Hero` · `ButtonBar` (row, hint; + bottom inset) · `ModeBar` (applicant mode) · `Content` · `useTabBarOptions()` + `TabIcon` |
| Brand | `Logo` (height) · `LogoMark` (variant app/mono) · `Wordmark` — paths from `design/v2-indigo/logo` |
| Other | `SignaturePad` (onChange → {path,width,height} \| null) · `haptics.tick/success/error` |
