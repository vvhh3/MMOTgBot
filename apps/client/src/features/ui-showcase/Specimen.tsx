import type { ReactNode } from "react";

export default function Specimen({ title, usage, children, wide = false }: {
  title: string; usage: string; children: ReactNode; wide?: boolean;
}) {
  return <article className={`ui-specimen${wide ? " ui-specimen--wide" : ""}`}>
    <div className="ui-specimen-label"><h3>{title}</h3><span>{usage}</span></div>
    <div className="ui-specimen-preview">{children}</div>
  </article>;
}
