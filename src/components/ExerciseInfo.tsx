import type { Exercise } from '../lib/types';
import { imgUrl, videoSearchUrl } from '../lib/exercises';
import { RepoPhoto } from './ui';

/** The "what is this machine and how do I use it" panel, shared by the guide and the picker. */
export function ExerciseInfo({ ex }: { ex: Exercise }) {
  return (
    <div className="stack">
      {ex.photo ? (
        <RepoPhoto path={ex.photo} alt={ex.name} className="thumb lg" />
      ) : ex.images.length ? (
        <div className="photos">
          {ex.images.map((src, i) => (
            <figure key={src}>
              <img src={imgUrl(src)} alt={`${ex.name}: ${i === 0 ? 'start' : 'end'} position`} loading="lazy" />
              <figcaption>{i === 0 ? 'Start' : 'End'}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <div className="row-wrap">
        <span className="tag accent">{ex.group}</span>
        <span className="tag">{ex.equipment}</span>
        {ex.assisted && <span className="tag gold">Assisted: more weight = easier</span>}
        {ex.loadFactor === 2 && <span className="tag gold">Log the weight of ONE dumbbell</span>}
        {ex.barKg !== undefined && <span className="tag gold">Log the TOTAL: bar (~{ex.barKg} kg) + all plates</span>}
        {ex.primaryMuscles.filter((m) => m !== ex.group).map((m) => (
          <span key={m} className="tag">{m}</span>
        ))}
      </div>

      {ex.aliases.length > 0 && (
        <p className="small dim">
          <b className="muted">Also called: </b>
          {ex.aliases.join(' · ')}
        </p>
      )}

      {ex.look && (
        <div className="notice">
          <b>{ex.custom ? 'My notes' : 'How to recognise it'}</b>
          <div className="dim" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{ex.look}</div>
        </div>
      )}

      {ex.instructions.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <h3>How to do it</h3>
          <ol className="steps">
            {ex.instructions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {ex.secondaryMuscles.length > 0 && <p className="small muted">Also works: {ex.secondaryMuscles.join(', ')}</p>}

      <a className="btn" href={videoSearchUrl(ex)} target="_blank" rel="noopener noreferrer">
        ▶ Watch videos of this exercise
      </a>
    </div>
  );
}
