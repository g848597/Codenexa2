import { ArrowUpRight, ArrowDownRight } from "lucide-react";
export default function Delta({ value }) {
  const positive = value >= 0;
  return (
    <span className="cnb-delta" style={{ color: positive ? "#17D896" : "#FF5C5C" }}>
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value)}%
    </span>
  );
}
