import { Order } from "../types";

interface Props {
  orders: Order[];
}

export default function Review({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <div className="page">
        <h1>Review</h1>
        <p className="subtitle">No orders loaded. Go back to Import first.</p>
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
