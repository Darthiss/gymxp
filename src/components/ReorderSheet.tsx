import type { Exercise } from '../lib/types';
import { Icon } from './Icon';
import { ExerciseThumb, Sheet } from './ui';

/** A compact list for changing the order of exercises, since the full cards are too tall to shuffle. */
export function ReorderSheet({ ids, exMap, onMove, onClose }: { ids: string[]; exMap: Map<string, Exercise>; onMove: (from: number, to: number) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} title="Reorder exercises">
      <div className="group">
        {ids.map((id, i) => {
          const ex = exMap.get(id);
          return (
            <div key={id} className="cell static" style={{ '--inset': '68px' } as React.CSSProperties}>
              <ExerciseThumb ex={ex} className="thumb sm" />
              <span className="grow bold small">{ex?.name ?? 'Unknown'}</span>
              <button className="icon-btn plain" disabled={i === 0} style={{ opacity: i === 0 ? 0.25 : 1 }} onClick={() => onMove(i, i - 1)} aria-label={`Move ${ex?.name ?? 'exercise'} up`}><Icon name="arrowUp" size={18} /></button>
              <button className="icon-btn plain" disabled={i === ids.length - 1} style={{ opacity: i === ids.length - 1 ? 0.25 : 1 }} onClick={() => onMove(i, i + 1)} aria-label={`Move ${ex?.name ?? 'exercise'} down`}><Icon name="arrowDown" size={18} /></button>
            </div>
          );
        })}
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={onClose}>Done</button>
    </Sheet>
  );
}
