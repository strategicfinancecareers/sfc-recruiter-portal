import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Two app_settings rows driven from one place:
//   sfc_framework                — system prompt sent to Claude for Take drafting
//   sfc_take_auto_draft_enabled  — fires the auto-draft hook on candidate submission
//
// Reads + writes through /api/admin-settings (service-role, admin-only). The
// PostgREST RLS on app_settings is admin-only, but routing through the API
// keeps auth + updated_by stamping in one place.

interface Props {
  adminUserId: string;
}

const FRAMEWORK_KEY = 'sfc_framework';
const TOGGLE_KEY = 'sfc_take_auto_draft_enabled';

// app_settings.value is JSONB — could come back as a JSON-encoded string
// or as a raw value depending on insert path. Normalize for the textarea.
function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export default function SfcAiSettings({ adminUserId }: Props) {
  const { toast } = useToast();
  const [framework, setFramework] = useState<string>('');
  const [frameworkOriginal, setFrameworkOriginal] = useState<string>('');
  const [autoDraft, setAutoDraft] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [savingFw, setSavingFw] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-settings?adminUserId=${encodeURIComponent(adminUserId)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      const fw = body.settings?.find((s: any) => s.key === FRAMEWORK_KEY);
      const tg = body.settings?.find((s: any) => s.key === TOGGLE_KEY);
      const fwText = toText(fw?.value);
      setFramework(fwText);
      setFrameworkOriginal(fwText);
      setAutoDraft(tg?.value === true || tg?.value === 'true');
    } catch (err: any) {
      console.error('[SfcAiSettings] load failed:', err);
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [adminUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveFramework = async () => {
    setSavingFw(true);
    try {
      const res = await fetch('/api/admin-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId,
          key: FRAMEWORK_KEY,
          // Always store as a plain string in JSONB so downstream
          // generate-sfc-take can read it without parsing.
          value: framework,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setFrameworkOriginal(framework);
      toast({ title: 'Framework saved', description: 'New drafts will use the updated framework immediately.' });
    } catch (err: any) {
      console.error('[SfcAiSettings] save framework failed:', err);
      toast({ title: 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSavingFw(false);
    }
  };

  const toggleAutoDraft = async (nextValue: boolean) => {
    setSavingToggle(true);
    setAutoDraft(nextValue); // optimistic
    try {
      const res = await fetch('/api/admin-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId, key: TOGGLE_KEY, value: nextValue }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      toast({ title: nextValue ? 'Auto-drafting enabled' : 'Auto-drafting disabled' });
    } catch (err: any) {
      console.error('[SfcAiSettings] toggle failed:', err);
      setAutoDraft(!nextValue); // rollback
      toast({ title: 'Toggle failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSavingToggle(false);
    }
  };

  const fwDirty = framework !== frameworkOriginal;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SFC Framework</CardTitle>
          <CardDescription>
            This framework is the system prompt Claude uses when drafting Takes. Edit it freely — changes apply to the next draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {!loading && !error && (
            <>
              <Textarea
                value={framework}
                onChange={e => setFramework(e.target.value)}
                rows={32}
                className="text-sm font-mono leading-relaxed"
                placeholder="Paste the SFC evaluation framework markdown here…"
              />
              <div className="flex items-center gap-3">
                <Button
                  onClick={saveFramework}
                  disabled={!fwDirty || savingFw}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingFw ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save framework</>}
                </Button>
                {fwDirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Drafting</CardTitle>
          <CardDescription>
            When on, Claude drafts an SFC Take in the background whenever a candidate submits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="auto-draft-toggle" className="text-sm">
                Auto-draft on new submissions
              </Label>
              <Switch
                id="auto-draft-toggle"
                checked={autoDraft}
                disabled={savingToggle}
                onCheckedChange={toggleAutoDraft}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
