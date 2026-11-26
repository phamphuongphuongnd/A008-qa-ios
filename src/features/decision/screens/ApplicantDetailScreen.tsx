/**
 * S-09 Applicant detail (F-11) — product.md §5 S-09, mockup v2 "Applicant Detail". Two badges per criterion, never a
 * score: summary, issues to check (with the button to fix each), criteria (tap → evidence sheet), sections, then
 * "Make a decision" (blocked with the reason: First-come turn, closed) or "Create notice" while an FCRA notice is pending.
 * Everything shown comes from `applicantDetailView` (../viewModel).
 */
import { useLocalSearchParams, type Href } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { fileStore } from '@/files';
import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import {
  AppBar,
  Banner,
  Button,
  ButtonBar,
  Card,
  Chip,
  ConfirmDialog,
  CriterionRow,
  Hero,
  IconButton,
  IssueItem,
  IssuesCard,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  SummaryCard,
  haptics,
  showSnackbar,
} from '@/ui';

import { deleteApplicantAction, markWithdrawnByApplicant } from '../decision';
import { decisionDeps } from '../deps';
import { useApplicantReview } from '../hooks';
import { evidenceDetail, type ApplicantReview } from '../review';
import { applicantDetailView, evidenceSheetView, referenceLinks } from '../viewModel';
import { Hint, idParam, NotFoundScreen } from '../components/DecisionParts';
import { EvidenceSheet } from '../components/EvidenceSheet';

export default function ApplicantDetailScreen() {
  const p = useLocalSearchParams<{ id: string }>();
  const review = useApplicantReview(idParam(p.id));
  if (!review) return <NotFoundScreen title={t('decision:s09.title')} />;
  return <ApplicantDetail review={review} />;
}

type Dialog = 'withdrawn' | 'delete' | null;

function ApplicantDetail({ review }: { review: ApplicantReview }) {
  const view = applicantDetailView(review);
  const id = review.bundle.applicant.id;
  const [menu, setMenu] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const result = evidenceFor ? review.evaluation.results.find((r) => r.criterionId === evidenceFor) : undefined;
  const sheet = result ? evidenceSheetView(evidenceDetail(result, review.bundle, review.applicant)) : null;
  const refs = refsOpen ? referenceLinks(review) : [];
  const hasMenu = view.menu.edit || view.menu.withdrawn || view.menu.delete;

  const go = (href: string) => router.push(href as Href);

  const runDialog = async () => {
    setBusy(true);
    try {
      if (dialog === 'withdrawn') {
        const r = await markWithdrawnByApplicant(decisionDeps, id);
        if (!r.ok) throw new Error(r.message);
        haptics.success();
        showSnackbar({ message: t('decision:s09.withdrawnDone') });
      } else if (dialog === 'delete') {
        const r = await deleteApplicantAction({ ...decisionDeps, files: fileStore }, id);
        if (!r.ok) throw new Error(r.message);
        haptics.success();
        showSnackbar({ message: t('decision:s09.deletedDone') });
        router.back();
      }
    } catch (e) {
      haptics.error();
      showSnackbar({ message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const footer = (() => {
    const f = view.footer;
    switch (f.kind) {
      case 'decide':
        return (
          <ButtonBar hint={f.hint ?? undefined}>
            <Button label={t('decision:s09.makeDecision')} block disabled={!f.enabled} onPress={() => router.push(routes.decision(id))} />
          </ButtonBar>
        );
      case 'notice':
        return (
          <ButtonBar hint={f.hint}>
            <Button label={f.label} block onPress={() => go(f.href)} />
          </ButtonBar>
        );
      case 'letter':
        return (
          <ButtonBar>
            <Button label={f.label} variant="secondary" block onPress={() => go(f.href)} />
          </ButtonBar>
        );
      default:
        return undefined;
    }
  })();

  return (
    <Screen
      header={
        <AppBar
          title={t('decision:s09.title')}
          right={
            hasMenu ? <IconButton icon={MoreHorizontal} accessibilityLabel={t('decision:s09.more')} onPress={() => setMenu(true)} /> : undefined
          }
        />
      }
      footer={footer}
    >
      <Hero title={view.name} meta={view.received}>
        <Chip label={view.chip.label} tone={view.chip.tone} />
        {view.inLine ? <Chip label={view.inLine} tone="outline" /> : null}
      </Hero>
      {view.statusNote ? <Banner tone="info">{view.statusNote}</Banner> : null}

      <SummaryCard ready={view.summary.ready} title={view.summary.title} subtitle={view.summary.subtitle} />

      {view.issues ? (
        <IssuesCard title={view.issues.title}>
          {view.issues.items.map((i) => (
            <IssueItem
              key={i.key}
              outcome={i.outcome}
              evidence={i.evidence}
              title={i.title}
              detail={i.detail || undefined}
              action={i.action ? { label: i.action.label, onPress: () => go(i.action!.href) } : undefined}
            />
          ))}
        </IssuesCard>
      ) : null}

      <View>
        <SectionHeader title={t('decision:s09.criteria')} />
        <Card variant="flush">
          {view.criteria.map((c) => (
            <CriterionRow key={c.key} name={c.name} outcome={c.outcome} evidence={c.evidence} reason={c.reason} onPress={() => setEvidenceFor(c.key)} />
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title={t('decision:s09.sections')} />
        <ListGroup>
          {view.sections.map((s) => (
            <ListRow
              key={s.key}
              title={s.title}
              value={s.value}
              chevron
              accessibilityLabel={s.a11y}
              onPress={() => (s.href ? go(s.href) : setRefsOpen(true))}
            />
          ))}
        </ListGroup>
      </View>

      {/* Evidence sheet: source, date, who checked, files, the place to add more. */}
      <EvidenceSheet sheet={sheet} onClose={() => setEvidenceFor(null)} onAction={go} />

      {/* References: one call sheet per rented home / employer. */}
      <Sheet visible={refsOpen} onClose={() => setRefsOpen(false)} title={t('decision:s09.referencesTitle')}>
        {refs.length ? (
          <ListGroup>
            {refs.map((r) => (
              <ListRow
                key={r.key}
                title={r.title}
                subtitle={r.subtitle}
                chevron
                onPress={() => {
                  setRefsOpen(false);
                  go(r.href);
                }}
              />
            ))}
          </ListGroup>
        ) : (
          <Hint>{t('decision:s09.noReferences')}</Hint>
        )}
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListGroup>
          {view.menu.edit ? (
            <ListRow
              title={t('decision:s09.menu.edit')}
              onPress={() => {
                setMenu(false);
                router.push(routes.applicationEdit(id));
              }}
            />
          ) : null}
          {view.menu.withdrawn ? (
            <ListRow
              title={t('decision:s09.menu.withdrawn')}
              onPress={() => {
                setMenu(false);
                setDialog('withdrawn');
              }}
            />
          ) : null}
          {view.menu.delete ? (
            <ListRow
              title={t('decision:s09.menu.delete')}
              danger
              onPress={() => {
                setMenu(false);
                setDialog('delete');
              }}
            />
          ) : null}
        </ListGroup>
      </Sheet>

      <ConfirmDialog
        visible={dialog === 'withdrawn'}
        tone="warn"
        title={t('decision:s09.withdrawnConfirm.title')}
        body={t('decision:s09.withdrawnConfirm.body', { name: view.name })}
        confirmLabel={t('decision:s09.withdrawnConfirm.confirm')}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={runDialog}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        tone="danger"
        destructive
        title={t('decision:s09.deleteConfirm.title')}
        body={t('decision:s09.deleteConfirm.body', { name: view.name })}
        confirmLabel={t('decision:s09.deleteConfirm.confirm')}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={runDialog}
      />
    </Screen>
  );
}
