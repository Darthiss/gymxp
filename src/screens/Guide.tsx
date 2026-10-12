import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { allExercises, searchExercises } from '../lib/exercises';
import { settingFor, useExerciseMap, useGame } from '../lib/game';
import { navigate } from '../lib/router';
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/types';
import { fmtDate, uid } from '../lib/util';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { ExerciseThumb, PageHead, RepoPhoto, toast } from '../components/ui';
import { SettingNote } from './Log';

export function Guide() {
  const data = useData();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('All');
  const all = useMemo(() => allExercises(data), [data]);
  const list = useMemo(() => {
    const l = searchExercises(all, q);
    return group === 'All' || q ? l : group === 'Mine' ? l.filter((e) => e.custom) : l.filter((e) => e.group === group);
  }, [all, q, group]);
  const hasCustom = all.some((e) => e.custom);

  return (
    <div className="stack">
      <PageHead title="Machine guide" right={<a className="btn sm" href="#/guide-edit/new">＋ My machine</a>} />
      <p className="small dim">Find a machine by body part or any name your coach used. Each one has start/end photos and step-by-step instructions.</p>
      <input className="input" placeholder="Search: pulldown, pec deck, leg…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && (
        <div className="chips">
          {['All', ...(hasCustom ? ['Mine'] : []), ...MUSCLE_GROUPS].map((g) => (
            <button key={g} className={`chip${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
      )}
      <div className="ex-grid">
        {list.map((e) => (
          <a key={e.id} className="ex-card" href={`#/guide/${encodeURIComponent(e.id)}`}>
            <ExerciseThumb ex={e} />
            <div className="body">
              <div className="name">{e.name}</div>
              <div className="tiny muted ellipsis">{e.custom ? 'My machine' : `${e.group} · ${e.equipment}`}</div>
            </div>
          </a>
        ))}
      </div>
      {list.length === 0 && (
        <div className="card stack center">
          <p className="dim">No match for “{q}”.</p>
          <a className="btn primary" href="#/guide-edit/new">📷 Add it as my own machine</a>
        </div>
      )}
      <p className="tiny muted center" style={{ marginTop: 12 }}>
        Exercise photos & instructions: free-exercise-db (public domain).
      </p>
    </div>
  );
}

export function GuideDetail({ id }: { id: string }) {
  const data = useData();
  const exMap = useExerciseMap();
  const g = useGame();
  const ex = exMap.get(id);
  if (!ex) return <PageHead title="Not found" backTo="guide" />;
  const best = g.bests.get(id);
  return (
    <div className="stack-lg">
      <PageHead title={ex.name} backTo="guide" right={ex.custom ? <a className="btn sm" href={`#/guide-edit/${encodeURIComponent(id)}`}>Edit</a> : undefined} />
      <ExerciseInfo ex={ex} />
      <div className="card stack">
        <h3>My stats</h3>
        <SettingNote exerciseId={id} value={settingFor(data, id)} />
        {best ? (
          <a className="row between card-link" href={`#/lift/${encodeURIComponent(id)}`}>
            <span className="small dim">Best {best.maxKg} kg · {best.sessions} sessions · last {fmtDate(best.lastDate)}</span>
            <span className="small">Chart →</span>
          </a>
        ) : (
          <span className="small muted">Not logged yet. Your first time earns +15 XP.</span>
        )}
      </div>
    </div>
  );
}

export function CustomExerciseEdit({ id }: { id: string }) {
  const data = useData();
  const existing = id !== 'new' ? data.customExercises.find((c) => c.id === id && !c.deleted) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [group, setGroup] = useState<MuscleGroup>(existing?.group ?? 'Legs');
  const [aliases, setAliases] = useState(existing?.aliases.join(', ') ?? '');
  const [look, setLook] = useState(existing?.look ?? '');
  const [assisted, setAssisted] = useState(!!existing?.assisted);
  const [photo, setPhoto] = useState(existing?.photo);
  const [uploading, setUploading] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      setPhoto(await getStore().uploadPhoto(f));
    } catch (e) {
      toast(`Photo upload failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!name.trim()) return toast('Give it a name (even “Machine by the window”)');
    const rec = {
      id: existing?.id ?? `c_${uid()}`,
      updatedAt: Date.now(),
      name: name.trim(),
      group,
      aliases: aliases.split(',').map((s) => s.trim()).filter(Boolean),
      look: look.trim(),
      assisted: assisted || undefined,
      photo,
    };
    getStore().update((d) => {
      d.customExercises = d.customExercises.filter((c) => c.id !== rec.id);
      d.customExercises.push(rec);
    }, `${existing ? 'Edit' : 'Add'} machine ${rec.name}`);
    navigate(`guide/${encodeURIComponent(rec.id)}`, true);
  };

  const remove = () => {
    if (!existing) return;
    getStore().update((d) => {
      const c = d.customExercises.find((x) => x.id === existing.id);
      if (c) { c.deleted = true; c.updatedAt = Date.now(); }
    }, `Delete machine ${existing.name}`);
    navigate('guide', true);
  };

  return (
    <div className="stack">
      <PageHead title={existing ? 'Edit machine' : 'My machine'} backTo="guide" />
      <p className="small dim">Don't know what it's called? Snap a photo at the gym and describe it. Ask your coach the name later.</p>
      <label className="btn block" style={{ minHeight: 160, flexDirection: 'column', overflow: 'hidden', padding: photo ? 0 : 16 }}>
        {uploading ? <span className="spinner" /> : photo ? <RepoPhoto path={photo} alt="Machine photo" className="thumb lg" /> : <><span style={{ fontSize: '2rem' }}>📷</span>Take / choose a photo</>}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Glute machine, the purple one" /></label>
      <label className="field">
        Body part
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)}>
          {MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label>
      <label className="field">Other names (comma separated)<input className="input" value={aliases} onChange={(e) => setAliases(e.target.value)} /></label>
      <label className="field">Notes: how to use it, what coach said<textarea className="input" value={look} onChange={(e) => setLook(e.target.value)} /></label>
      <label className="row small" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={assisted} onChange={(e) => setAssisted(e.target.checked)} style={{ width: 20, height: 20 }} />
        Assisted machine (the weight helps you, like an assisted pull-up)
      </label>
      <button className="btn primary big block" onClick={save} disabled={uploading}>Save</button>
      {existing && <button className="btn danger block" onClick={remove}>Delete machine</button>}
    </div>
  );
}
