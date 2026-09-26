import { Link } from "react-router-dom";

export default function NotFound({ inConsole = false }: { inConsole?: boolean }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-[14px] uppercase tracking-[.2em] text-brand">404</p>
      <h1 className="text-[44px] font-extrabold text-ink">Nothing was <span className="font-serif font-normal italic text-gradient">teleported</span> here.</h1>
      <Link to={inConsole ? "/console" : "/"} className="btn-primary">{inConsole ? "Back to Mission Control" : "Back home"}</Link>
    </div>
  );
}
