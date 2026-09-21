import { expandSets } from "../shared/sets";

// One line for each set: reps, kg, rest and the remark.
export default function SetLines({ log }) {
  const sets = expandSets(log);
  return (
    <div className="set-lines">
      {sets.map((s, i) => (
        <div className="set-line" key={i}>
          <span className="set-no">Set {i + 1}</span>{" "}
          <span>{s.reps} reps</span>{" "}
          {s.weight !== null && <span>{s.weight} kg</span>}{" "}
          {s.rest !== null && <span>rest {s.rest}s</span>}{" "}
          {s.remark && <span className="set-remark">{s.remark}</span>}
        </div>
      ))}
    </div>
  );
}
