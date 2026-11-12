// The routine check as a card: up to 3 findings, each with its reason and a one-tap add.
import type { Finding } from '../lib/routineCheck';
import type { Exercise, Routine } from '../lib/types';
import { Bro } from './Bro';
import { Icon } from './Icon';

export function RoutineCheckCard({ title, sub, findings, exMap, routines, onAdd, allGood, showRoutine = true }: {
  title: string;
  sub: string;
  findings: Finding[];
  exMap: Map<string, Exercise>;
  routines: Routine[];
  onAdd: (f: Finding) => void;
  allGood: string; // shown when there's nothing to say
  showRoutine?: boolean; // name the routine on the button (off inside that routine's own editor)
}) {
  return (
    <section className="card stack" style={{ gap: 14 }} aria-label={title}>
      <div className="row" style={{ gap: 12 }}>
        <Bro mood={findings.length ? 'focus' : 'hype'} size={46} />
        <div className="grow">
          <h3>{title}</h3>
          <div className="tiny dim">{sub}</div>
        </div>
      </div>
      {findings.length === 0 ? (
        <p className="small dim" style={{ lineHeight: 1.45 }}>{allGood}</p>
      ) : (
        <div className="findings">
          {findings.map((f) => {
            const ex = f.add ? exMap.get(f.add.exerciseId) : undefined;
            const r = f.add ? routines.find((x) => x.id === f.add!.routineId) : undefined;
            return (
              <div key={f.id} className="finding">
                <div className="bold">{f.title}</div>
                <div className="small dim">{f.reason}</div>
                {ex && (
                  <button className="btn sm tint" onClick={() => onAdd(f)}>
                    <Icon name="plus" size={15} stroke={2.6} />
                    <span>Add {ex.name}{showRoutine && r ? ` to ${r.name}` : ''}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
