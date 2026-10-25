import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Wand2, Save, Send, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { authedFetch } from '@/integrations/supabase/authedFetch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Candidate shape needed for the editor — mirrors fields used downstream.
export interface SfcTakeCandidate {
  id: string;
  name: string;
  sfc_take?: string | null;
  sfc_take_draft_generated_at?: string | null;
  sfc_take_published_at?: string | null;
  sfc_take_model?: string | null;
}

interface Props {
  candidate: SfcTakeCandidate;
  adminUserId: string;
  // Fired after Save, Regenerate, or Publish/Unpublish so the parent can
  // refetch the candidate list (badge counts + downstream state).
  onChanged?: () => void;
}

const arraysEqual = (a: string[] | null | undefined, b: string[] | null | undefined): boolean => {
  const la = a || [];
  const lb = b || [];
  if (la.length !== lb.length) return false;
  return la.every((v, i) => v === lb[i]);
};

export default function SfcTakeEditor({ candidate, adminUserId, onChanged }: Props) {
  // Local editable state — initialized from candidate, reset on id change.
  const [takeText, setTakeText] = useState<string>(candidate.sfc_take || '');

  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  // Track when we're showing a different candidate so we reset locals.
  useEffect(() => {
    setTakeText(candidate.sfc_take || '');
  }, [candidate.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { toast } = useToast();

  const hasDraft = !!candidate.sfc_take_draft_generated_at;
  const isPublished = !!candidate.sfc_take_published_at;
  const statusLabel = isPublished ? 'Published' : (hasDraft ? 'Draft' : 'Not drafted');
  const statusClass = isPublished
    ? 'bg-[#008037]/12 text-[#005a26] border-[#008037]/25'
    : hasDraft
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-gray-100 text-gray-600 border-gray-200';

  const isDirty = useMemo(() => (
    takeText !== (candidate.sfc_take || '')
  ), [takeText, candidate]);

  // ── Generate / Regenerate ──────────────────────────────────────────────────
  const runGenerate = async () => {
    setRegenerating(true);
    try {
      const res = await authedFetch('/api/generate-sfc-take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, adminUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.detail || `Failed (${res.status})`);
      setTakeText(body.sfc_take || '');
      toast({
        title: 'Draft generated',
        description: body.sfc_take_model ? `Model: ${body.sfc_take_model}` : undefined,
      });
      onChanged?.();
    } catch (err: any) {
      console.error('[SfcTakeEditor] generate failed:', err);
      toast({ title: 'Generation failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerateClick = () => {
    if (isDirty) {
      setConfirmRegenOpen(true);
    } else {
      runGenerate();
    }
  };

  // ── Save (direct Supabase update — admin RLS allows) ──────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          sfc_take: takeText || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);
      if (error) throw error;
      toast({ title: 'Draft saved' });
      onChanged?.();
    } catch (err: any) {
      console.error('[SfcTakeEditor] save failed:', err);
      toast({ title: 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Publish / Unpublish ───────────────────────────────────────────────────
  const handleTogglePublish = async () => {
    setPublishing(true);
    try {
      const res = await authedFetch('/api/publish-sfc-take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          adminUserId,
          unpublish: isPublished,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      toast({ title: isPublished ? 'Unpublished' : 'Published — visible to recruiters' });
      onChanged?.();
    } catch (err: any) {
      console.error('[SfcTakeEditor] publish failed:', err);
      toast({ title: 'Publish failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  // ── Render: empty state for candidates with no draft yet ───────────────────
  if (!hasDraft && !takeText) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">SFC Take</CardTitle>
            <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground italic">
            No Take drafted yet. The auto-draft hook runs on new submissions if the toggle is on; otherwise generate one manually.
          </p>
          <Button
            onClick={runGenerate}
            disabled={regenerating}
            className="bg-[#008037] hover:bg-[#006a2d] text-white"
          >
            {regenerating
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating (15–30s)…</>
              : <><Wand2 className="w-4 h-4 mr-2" />Generate draft</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Render: full editor ───────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">SFC Take</CardTitle>
            <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
          </div>
          {candidate.sfc_take_draft_generated_at && (
            <p className="text-xs text-muted-foreground">
              Last drafted: {formatDistanceToNow(new Date(candidate.sfc_take_draft_generated_at))} ago
              {candidate.sfc_take_model && ` · model: ${candidate.sfc_take_model}`}
              {isPublished && candidate.sfc_take_published_at &&
                ` · published ${formatDistanceToNow(new Date(candidate.sfc_take_published_at))} ago`}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Take</Label>
            <Textarea
              value={takeText}
              onChange={e => setTakeText(e.target.value)}
              rows={9}
              className="mt-1.5 text-sm leading-relaxed"
              placeholder="120–180 word prose analysis…"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateClick}
              disabled={regenerating || saving || publishing}
            >
              {regenerating
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Regenerating…</>
                : <><Wand2 className="w-3.5 h-3.5 mr-1" />Regenerate</>}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving || regenerating || publishing}
              className="bg-[#008037] hover:bg-[#006a2d] text-white"
            >
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving…</>
                : <><Save className="w-3.5 h-3.5 mr-1" />Save</>}
            </Button>
            <Button
              size="sm"
              variant={isPublished ? 'outline' : 'default'}
              onClick={handleTogglePublish}
              disabled={publishing || saving || regenerating}
              className={isPublished ? '' : 'bg-blue-600 hover:bg-blue-700 text-white'}
            >
              {publishing
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Working…</>
                : isPublished
                  ? <><Undo2 className="w-3.5 h-3.5 mr-1" />Unpublish</>
                  : <><Send className="w-3.5 h-3.5 mr-1" />Publish</>}
            </Button>
            {isDirty && (
              <span className="text-xs text-amber-700 self-center">Unsaved edits</span>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRegenOpen} onOpenChange={(open) => { if (!open && !regenerating) setConfirmRegenOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your edits?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your unsaved edits with a fresh AI draft. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={regenerating}
              onClick={(e) => { e.preventDefault(); setConfirmRegenOpen(false); runGenerate(); }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
