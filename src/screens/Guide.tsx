import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { allExercises, EQUIPMENT_CHIPS, searchExercises } from '../lib/exercises';
import { settingFor, useExerciseMap, useGame } from '../lib/game';
import { navigate } from '../lib/router';
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/types';
import { fmtDate, uid } from '../lib/util';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Cell, CellIcon, ExerciseThumb, LargeTitle, PageHead, RepoPhoto, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { masteryOf } from '../lib/xp';
import { SettingNote } from './Log';

export function Guide() {
  const data = useData();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('All');
  const all = useMemo(() => allExercises(data), [data]);
  const list = useMemo(() => {
    const l = searchExercises(all, q);
    return group === 'All' || q ? l : group === 'Mine' ? l.filter((e) => e.custom) : EQUIPMENT_CHIPS[group] ? l.filter(EQUIPMENT_CHIPS[group]) : l.filter((e) => e.group === group);
  }, [all, q, group]);
  const hasCustom = all.some((e) => e.custom);

  return (
    <div className="stack fade-in">
      <LargeTitle
        eyebrow={`${all.length} exercises`}
        title="Guide"
        actions={<a className="icon-btn" href="#/guide-edit/new" aria-label="Add my own machine"><Icon name="camera" size={18} /></a>}
      />
      <div className="search">
        <Icon name="search" size={17} />
        <input className="input" placeholder="Pulldown, pec deck, leg…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      {!q && (
        <div className="chips">
          {['All', ...(hasCustom ? ['Mine'] : []), ...Object.keys(EQUIPMENT_CHIPS), ...MUSCLE_GROUPS].map((g) => (
            <button key={g} className={`chip${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
      )}
      <div className="ex-grid" style={{ marginTop: 4 }}>
        {list.map((e) => (
          <a key={e.id} className="ex-card" href={`#/guide/${encodeURIComponent(e.id)}`}>
            <ExerciseThumb ex={e} />
            <div className="body">
              <div className="name">{e.name}</div>
              <div className="tiny dim ellipsis">{e.custom ? 'My machine' : `${e.group} · ${e.equipment}`}</div>
            </div>
          </a>
        ))}
      </div>
      {list.length === 0 && (
        <div className="card stack center" style={{ alignItems: 'center' }}>
          <p className="dim">No match for “{q}”.</p>
          <a className="btn primary" href="#/guide-edit/new"><Icon name="camera" size={18} /> Add it as my own machine</a>
        </div>
      )}
      <p className="tiny muted center" style={{ marginTop: 16 }}>
        Photos & instructions: free-exercise-db (public domain).
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
  const m = best ? masteryOf(best.sessions) : null;
  return (
    <div className="stack-lg">
      <PageHead title={ex.name} backTo="guide" right={ex.custom ? <a className="btn sm" href={`#/guide-edit/${encodeURIComponent(id)}`}>Edit</a> : undefined} />
      <ExerciseInfo ex={ex} />
      <div className="stack">
        <div className="section-title">My stats</div>
        <div className="group">
          <div className="cell static"><SettingNote exerciseId={id} value={settingFor(data, id)} equipment={ex.equipment} /></div>
          {best ? (
            <Cell href={`#/lift/${encodeURIComponent(id)}`} icon={<CellIcon name="chart" color="#30d158" />}
              title={`Best ${best.maxKg} kg · ${best.sessions} sessions`} sub={`${m?.current ? `${m.current.icon} ${m.current.name} mastery · ` : ''}last ${fmtDate(best.lastDate)}`} />
          ) : (
            <Cell icon={<CellIcon name="sparkles" color="#bf5af2" />} title="Not logged yet" sub="Your first time earns +15 XP" />
          )}
          <Cell href={`#/log?add=${encodeURIComponent(id)}`} icon={<CellIcon name="plus" color="#0a84ff" />} title="Add to a workout" />
        </div>
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
      <label className="btn block dashed" style={{ minHeight: 180, flexDirection: 'column', overflow: 'hidden', padding: photo ? 0 : 16, borderRadius: 'var(--r-lg)' }}>
        {uploading ? <span className="spinner" /> : photo ? <RepoPhoto path={photo} alt="Machine photo" className="thumb lg" /> : <><Icon name="camera" size={30} />Take / choose a photo</>}
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
