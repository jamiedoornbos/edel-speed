import { EdelweissItem } from "../types";

interface Props {
  items: EdelweissItem[];
}

export default function Review({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="page">
        <h1>Review</h1>
        <p className="subtitle">No items loaded. Go back to Import first.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Review</h1>
      <p className="subtitle">Coming soon — match against Lightspeed records here.</p>
    </div>
  );
}
