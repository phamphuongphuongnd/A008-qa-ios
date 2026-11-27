/**
 * S-20 Move-in checklist (product.md S-20, mockup v2 "S-20 Room items" + "Meters, keys, signatures"):
 * room chips · items with Good / Fair / Damaged + note + photos · "Add item" · meter readings · keys stepper ·
 * smoke & CO alarms · two signatures · "Export PDF" (needs both). Saved as you go; can be left and continued.
 * Any change after a signature asks first and clears both signatures (model.ts). Notes and meter readings save while
 * typing and flush on leave / background (autosave.ts, B-51).
 */
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Camera, FileDown, ImagePlus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { ItemCondition, MoveInItem } from '@/db/model';
import { formatDate } from '@/engine';
import { pick } from '@/features/intake/documents/picker';
import { expoAttachmentPicker } from '@/features/intake/documents/pickerNative';
import { withLockSuspended } from '@/features/settings/lockController';
import { files } from '@/files';
import { t } from '@/i18n';
import { parseId } from '@/routes';
import { font, useTheme } from '@/theme';
import {
  AppBar,
  BigOption,
  Button,
  ButtonBar,
  Card,
  Checkbox,
  ChoicePills,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
  Sheet,
  SignaturePad,
  Stepper,
  TextButton,
  TextField,
  Txt,
  showSnackbar,
  type SignatureValue,
} from '@/ui';

import { createFlushRegistry, useAutosaveText, type FlushRegistry } from '../autosave';
import { useMoveIn } from '../hooks';
import {
  CONDITIONS,
  KEYS_MAX,
  clampKeys,
  exportState,
  hasSignature,
  itemNameError,
  meterFields,
  moveInSubtitle,
  roomNameError,
  type MeterKind,
  type MoveInEdit,
  type SignatureRole,
} from '../model';

export default function MoveInScreen() {
  const params = useLocalSearchParams<{ rentalId: string; applicantId?: string }>();
  const rentalId = parseId(params.rentalId);
  const applicantId = parseId(params.applicantId);
  if (rentalId == null) return <NotFound />;
  return <MoveIn rentalId={rentalId} applicantId={applicantId} />;
}

function NotFound() {
  return (
    <Screen header={<AppBar title={t('system:s20.title')} />}>
      <EmptyState icon={X} title={t('system:s20.notFound')} />
    </Screen>
  );
}

type SheetState =
  | null
  | { kind: 'addItem' }
  | { kind: 'addRoom' }
  | { kind: 'renameRoom' }
  | { kind: 'photo'; item: number }
  | { kind: 'sign'; role: SignatureRole };

function MoveIn({ rentalId, applicantId }: { rentalId: number; applicantId: number | null }) {
  'use no memo';
  const m = useMoveIn(rentalId, applicantId);
  const [roomIdx, setRoomIdx] = useState(0);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [pending, setPending] = useState<MoveInEdit | null>(null);
  const [removeRoom, setRemoveRoom] = useState(false);
  const [showGas, setShowGas] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [exporting, setExporting] = useState(false);
  // B-51: notes / meters save while typing; anything else first flushes what they are still waiting to save.
  const [registry] = useState(createFlushRegistry);
  // Bumped when "Editing clears both signatures" is cancelled: remounts the text fields back to the saved values.
  const [fieldsRev, setFieldsRev] = useState(0);

  if (m.rental === null) return <NotFound />;
  const d = m.draft;
  if (!d) return <Screen header={<AppBar title={t('system:s20.title')} />}>{null}</Screen>;

  const room = Math.min(roomIdx, Math.max(0, d.rooms.length - 1));
  const current = d.rooms[room];
  const subtitle = moveInSubtitle(m.tenantName, m.handoverOn, formatDate);
  const exp = exportState(d);
  const hasPhotos = d.rooms.some((r) => r.items.some((i) => i.photoPaths?.length));

  /** Content edits after a signature ask first ("Editing clears both signatures"). */
  const edit = (e: MoveInEdit) => {
    if (e.type !== 'setNote' && e.type !== 'setMeter') registry.flushAll();
    if (hasSignature(d)) setPending(e);
    else m.edit(e);
  };

  const openSheet = (s: SheetState) => {
    registry.flushAll();
    setSheet(s);
  };

  const exportPdf = async () => {
    registry.flushAll();
    setExporting(true);
    try {
      await m.exportPdf(includePhotos && hasPhotos);
    } catch {
      showSnackbar({ message: t('system:s20.exportFailed') });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      header={<AppBar title={t('system:s20.title')} subtitle={subtitle} />}
      footer={
        <ButtonBar hint={exp.hint ?? undefined}>
          <Button label={t('system:s20.exportPdf')} icon={FileDown} onPress={exportPdf} disabled={!exp.enabled} loading={exporting} block />
        </ButtonBar>
      }
    >
      {/* Rooms */}
      {d.rooms.length ? (
        <ChoicePills
          accessibilityLabel={t('system:s20.rooms.label')}
          options={d.rooms.map((r, i) => ({ value: String(i), label: r.name }))}
          value={String(room)}
          onChange={(v) => {
            registry.flushAll();
            setRoomIdx(Number(v));
          }}
        />
      ) : null}
      <View style={styles.roomActions}>
        <TextButton label={t('system:s20.addRoom')} onPress={() => openSheet({ kind: 'addRoom' })} />
        {current ? <TextButton label={t('system:s20.renameRoom')} onPress={() => openSheet({ kind: 'renameRoom' })} /> : null}
        {current ? <TextButton label={t('system:s20.removeRoom')} tone="danger" onPress={() => {
              registry.flushAll();
              setRemoveRoom(true);
            }} /> : null}
      </View>

      {current?.items.map((item, i) => (
        <ItemCard
          key={`${room}-${i}-${item.name}-${fieldsRev}`}
          item={item}
          signed={hasSignature(d)}
          registry={registry}
          onCondition={(c) => edit({ type: 'setCondition', room, item: i, condition: c })}
          onNote={(note) => edit({ type: 'setNote', room, item: i, note })}
          onAddPhoto={() => openSheet({ kind: 'photo', item: i })}
          onRemovePhoto={(path) => edit({ type: 'removePhoto', room, item: i, path })}
          onRemove={() => edit({ type: 'removeItem', room, item: i })}
        />
      ))}
      {current ? <Button label={t('system:s20.addItem')} icon={Plus} variant="secondary" onPress={() => openSheet({ kind: 'addItem' })} block /> : null}

      {/* Meters, keys, alarms */}
      <SectionHeader title={t('system:s20.meters')} />
      <View style={styles.grid}>
        {meterFields(d, showGas).map((k) => (
          <MeterField
            key={`${k}-${fieldsRev}`}
            kind={k}
            value={d.meters[k] ?? ''}
            signed={hasSignature(d)}
            registry={registry}
            onCommit={(v) => edit({ type: 'setMeter', meter: k, value: v })}
          />
        ))}
      </View>
      {!meterFields(d, showGas).includes('gas') ? (
        <View style={{ alignItems: 'flex-start' }}>
          <TextButton label={t('system:s20.addGas')} onPress={() => setShowGas(true)} />
        </View>
      ) : null}
      <View style={styles.line}>
        <Txt style={styles.lineLabel}>{t('system:s20.keys')}</Txt>
        <Stepper
          display={String(d.keys ?? 0)}
          accessibilityLabel={t('system:s20.keys')}
          canDecrement={(d.keys ?? 0) > 0}
          canIncrement={(d.keys ?? 0) < KEYS_MAX}
          onDecrement={() => edit({ type: 'setKeys', keys: clampKeys((d.keys ?? 0) - 1) })}
          onIncrement={() => edit({ type: 'setKeys', keys: clampKeys((d.keys ?? 0) + 1) })}
        />
      </View>
      <View style={styles.line}>
        <Txt style={styles.lineLabel}>{t('system:s20.alarms')}</Txt>
        <ChoicePills
          accessibilityLabel={t('system:s20.alarms')}
          options={[
            { value: 'yes', label: t('system:s20.yes') },
            { value: 'no', label: t('system:s20.no') },
          ]}
          value={d.alarmsTested == null ? null : d.alarmsTested ? 'yes' : 'no'}
          onChange={(v) => edit({ type: 'setAlarms', tested: v === 'yes' })}
        />
      </View>

      {/* Signatures */}
      <SectionHeader title={t('system:s20.signatures')} />
      <View style={styles.grid}>
        {(['landlord', 'tenant'] as const).map((role) => (
          <SignatureBox key={role} role={role} signedAt={d.signatures[role]?.at ?? null} shape={m.signatureShape(role)} onPress={() => openSheet({ kind: 'sign', role })} />
        ))}
      </View>
      {hasPhotos ? <Checkbox label={t('system:s20.includePhotos')} value={includePhotos} onChange={setIncludePhotos} /> : null}

      {/* Sheets and dialogs */}
      <NameSheet
        visible={sheet?.kind === 'addItem'}
        title={t('system:s20.addItem')}
        label={t('system:s20.itemName')}
        initial=""
        validate={itemNameError}
        onClose={() => setSheet(null)}
        onSave={(name) => edit({ type: 'addItem', room, name })}
      />
      <NameSheet
        visible={sheet?.kind === 'addRoom'}
        title={t('system:s20.addRoom')}
        label={t('system:s20.roomName')}
        initial=""
        validate={(n) => roomNameError(n, d.rooms)}
        onClose={() => setSheet(null)}
        onSave={(name) => {
          edit({ type: 'addRoom', name });
          setRoomIdx(d.rooms.length);
        }}
      />
      <NameSheet
        visible={sheet?.kind === 'renameRoom'}
        title={t('system:s20.renameRoom')}
        label={t('system:s20.roomName')}
        initial={current?.name ?? ''}
        validate={(n) => roomNameError(n, d.rooms, room)}
        onClose={() => setSheet(null)}
        onSave={(name) => edit({ type: 'renameRoom', room, name })}
      />
      <PhotoSheet
        visible={sheet?.kind === 'photo'}
        onClose={() => setSheet(null)}
        onPicked={async (uri) => {
          const item = sheet?.kind === 'photo' ? sheet.item : 0;
          setSheet(null);
          if (hasSignature(d)) {
            // Keep the rule: a change after signing asks first. The photo is saved only if confirmed.
            setPending({ type: 'addPhoto', room, item, path: await savePhoto(rentalId, uri) });
          } else {
            await m.addPhoto(room, item, uri);
          }
        }}
      />
      <SignSheet
        role={sheet?.kind === 'sign' ? sheet.role : null}
        onClose={() => setSheet(null)}
        onDone={async (role, value) => {
          const ok = await m.sign(role, value);
          if (ok) setSheet(null);
          return ok;
        }}
      />
      <ConfirmDialog
        visible={!!pending}
        tone="warn"
        title={t('system:s20.editSigned')}
        confirmLabel={t('system:s20.editAnyway')}
        onCancel={() => {
          if (pending?.type === 'addPhoto') files.deleteFile(pending.path);
          if (pending?.type === 'setNote' || pending?.type === 'setMeter') setFieldsRev((r) => r + 1);
          setPending(null);
        }}
        onConfirm={() => {
          if (pending) m.edit(pending);
          setPending(null);
        }}
      />
      <ConfirmDialog
        visible={removeRoom}
        title={t('system:s20.removeRoomConfirm', { room: current?.name ?? '' })}
        confirmLabel={t('common:actions.delete')}
        destructive
        onCancel={() => setRemoveRoom(false)}
        onConfirm={() => {
          setRemoveRoom(false);
          edit({ type: 'removeRoom', room });
          setRoomIdx(Math.max(0, room - 1));
        }}
      />
    </Screen>
  );
}

async function savePhoto(rentalId: number, uri: string): Promise<string> {
  return (await files.saveImage({ owner: { rentalId }, kind: 'movein', sourceUri: uri })).path;
}

function ItemCard({
  item,
  signed,
  registry,
  onCondition,
  onNote,
  onAddPhoto,
  onRemovePhoto,
  onRemove,
}: {
  item: MoveInItem;
  signed: boolean;
  registry: FlushRegistry;
  onCondition: (c: ItemCondition) => void;
  onNote: (note: string) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (path: string) => void;
  onRemove: () => void;
}) {
  const saved = item.note ?? '';
  const note = useAutosaveText(
    saved,
    (v) => {
      if (v.trim() !== saved.trim()) onNote(v.trim());
    },
    { immediate: signed, registry },
  );
  const [noteOpen, setNoteOpen] = useState(!!item.note);
  return (
    <Card>
      <View style={styles.itemHead}>
        <Txt style={[font(600, 15, 20), { flex: 1 }]}>{item.name}</Txt>
        <IconButton icon={Camera} accessibilityLabel={t('system:s20.addPhotoFor', { item: item.name })} onPress={onAddPhoto} />
        <IconButton icon={X} accessibilityLabel={t('system:s20.removeItem', { item: item.name })} onPress={onRemove} />
      </View>
      <ChoicePills
        accessibilityLabel={t('system:s20.conditionOf', { item: item.name })}
        options={CONDITIONS.map((c) => ({ value: c, label: t(`system:s20.condition.${c}`) }))}
        value={item.condition ?? null}
        onChange={onCondition}
      />
      {noteOpen ? (
        <TextField label={t('system:s20.note')} value={note.text} onChangeText={note.onChangeText} onBlur={note.flush} onSubmitEditing={note.flush} multiline />
      ) : (
        <View style={{ alignItems: 'flex-start' }}>
          <TextButton label={t('system:s20.addNote')} onPress={() => setNoteOpen(true)} />
        </View>
      )}
      {item.photoPaths?.length ? (
        <View style={styles.thumbs}>
          {item.photoPaths.map((p) => (
            <Thumb key={p} path={p} onRemove={() => onRemovePhoto(p)} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function Thumb({ path, onRemove }: { path: string; onRemove: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.thumb, { borderRadius: radius.sm, borderColor: colors.line }]}>
      <Image source={{ uri: files.uri(path) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      <View style={styles.thumbX}>
        <IconButton icon={X} tone="filled" accessibilityLabel={t('system:s20.removePhoto')} onPress={onRemove} />
      </View>
    </View>
  );
}

function MeterField({
  kind,
  value,
  signed,
  registry,
  onCommit,
}: {
  kind: MeterKind;
  value: string;
  signed: boolean;
  registry: FlushRegistry;
  onCommit: (v: string) => void;
}) {
  const field = useAutosaveText(
    value,
    (v) => {
      if (v.trim() !== value) onCommit(v.trim());
    },
    { immediate: signed, registry },
  );
  const unit = t(`system:s20.meterUnit.${kind}`);
  return (
    <TextField
      label={t(`system:s20.meter.${kind}`)}
      value={field.text}
      onChangeText={field.onChangeText}
      onBlur={field.flush}
      onSubmitEditing={field.flush}
      keyboardType="numbers-and-punctuation"
      suffix={unit || undefined}
      style={styles.cell}
    />
  );
}

function SignatureBox({
  role,
  signedAt,
  shape,
  onPress,
}: {
  role: SignatureRole;
  signedAt: string | null;
  shape: { d: string; width: number; height: number } | null;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  const who = t(`system:s20.${role}`);
  return (
    <View style={[styles.cell, { gap: 6 }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={signedAt ? `${who}, ${t('system:s20.signedShort')}` : t('system:s20.signHere', { who })}
        style={[styles.sig, { borderColor: signedAt ? colors.line : colors.lineStrong, borderRadius: radius.md, backgroundColor: colors.surface1 }]}
      >
        {shape ? (
          <Svg width="100%" height="100%" viewBox={`0 0 ${shape.width} ${shape.height}`} preserveAspectRatio="xMidYMid meet">
            <Path d={shape.d} stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : (
          <Txt color="inkMuted" style={{ textAlign: 'center' }}>
            {signedAt ? t('system:s20.signedShort') : t('system:s20.signHere', { who })}
          </Txt>
        )}
      </Pressable>
      <Txt variant="caption" color={signedAt ? 'accent' : 'inkMuted'}>
        {signedAt ? `${who} ✓` : who}
      </Txt>
    </View>
  );
}

function NameSheet({
  visible,
  title,
  label,
  initial,
  validate,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  label: string;
  initial: string;
  validate: (name: string) => string | null;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  if (visible !== shown) {
    setShown(visible);
    if (visible) {
      setName(initial);
      setError(null);
    }
  }
  const save = () => {
    const e = validate(name);
    setError(e);
    if (e) return;
    onSave(name.trim());
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title} dirty={name !== initial} footer={<Button label={t('common:actions.save')} onPress={save} block />}>
      <TextField label={label} value={name} onChangeText={setName} error={error} autoFocus autoCapitalize="sentences" onSubmitEditing={save} />
    </Sheet>
  );
}

function PhotoSheet({ visible, onClose, onPicked }: { visible: boolean; onClose: () => void; onPicked: (uri: string) => void }) {
  const [denied, setDenied] = useState(false);
  const run = async (source: 'camera' | 'library') => {
    const r = await withLockSuspended(() => pick(expoAttachmentPicker, source));
    if (r.status === 'picked') onPicked(r.uri);
    else if (r.status === 'denied') setDenied(true);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('system:s20.addPhoto')}>
      {!denied ? <BigOption icon={Camera} title={t('system:s20.takePhoto')} onPress={() => run('camera')} /> : null}
      <BigOption icon={ImagePlus} title={t('system:s20.choosePhoto')} onPress={() => run('library')} />
      {denied ? <Txt color="inkMuted">{t('system:s20.cameraDenied')}</Txt> : null}
    </Sheet>
  );
}

function SignSheet({ role, onClose, onDone }: { role: SignatureRole | null; onClose: () => void; onDone: (role: SignatureRole, v: SignatureValue | null) => Promise<boolean> }) {
  const [value, setValue] = useState<SignatureValue | null>(null);
  const who = role ? t(`system:s20.${role}`) : '';
  return (
    <Sheet
      visible={role != null}
      onClose={() => {
        setValue(null);
        onClose();
      }}
      title={t('system:s20.signTitle', { who })}
      footer={
        <Button
          label={t('common:actions.done')}
          disabled={!value}
          onPress={async () => {
            if (role && (await onDone(role, value))) setValue(null);
          }}
          block
        />
      }
    >
      <Txt color="inkMuted">{t('system:s20.signHelp')}</Txt>
      {role ? <SignaturePad key={role} onChange={setValue} label={t('system:s20.signHere', { who })} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  roomActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, marginTop: -8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: -8 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 88, height: 66, overflow: 'hidden', borderWidth: 1 },
  thumbX: { position: 'absolute', top: -6, right: -6, transform: [{ scale: 0.75 }] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, flexBasis: 140 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flexShrink: 1, flexBasis: 140, flexGrow: 1 },
  sig: { height: 110, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 8 },
});
