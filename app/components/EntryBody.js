import SetLines from "./SetLines";
import { hasSetDetails, totalReps } from "../shared/sets";

// The text of one workout entry (used by Dashboard and Workout History).
export default function EntryBody({ e }) {
  const detailed = hasSetDetails(e);
  const n = Number(e.sets) || 0;
  return (
    <>
      <div className="hl">
        {detailed ? (
          <span>{n} {n === 1 ? "set" : "sets"} · {totalReps(e)} reps</span>
        ) : (
          <>
            <span>{e.sets} sets × {e.reps} reps</span>
            {e.weight ? <span>{e.weight} kg</span> : null}
          </>
        )}
      </div>
      <div className="name">
        {e.exercise_name}
        {e.category_name && <span className="badge">{e.category_name}</span>}
      </div>
      {detailed ? (
        <SetLines log={e} />
      ) : (
        <>
          {e.rest ? <div className="meta">Rest {e.rest}s between sets</div> : null}
          {e.remark && <div className="remark">{e.remark}</div>}
        </>
      )}
    </>
  );
}
