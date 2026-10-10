import { DATABASE_LABEL } from './environment'

/** The panel's own small lockup. Not the site's Logo: that one is a target
    of the home page's intro animation (data-logo-mark), and has no business
    being measured or hidden by it in here.

    Carries the database warning when the panel is not editing the live site
    (see environment.ts) — here because this lockup is on every screen of
    the panel, sign-in included. */
export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={`${import.meta.env.BASE_URL}logo-signal.png`}
        alt=""
        width={153}
        height={160}
        className="h-9 w-auto shrink-0"
      />
      <span className="text-base leading-none font-bold tracking-tight text-white">IMA</span>
      {/* Wrapped rather than given `hidden` directly — cn is a plain join, so
          a display utility on the tag itself would tie with any other. Gives
          way on a phone when the database label is up: a phone header has
          room for one tag beside the two account buttons, and that one is
          the warning. */}
      <span className={DATABASE_LABEL ? 'hidden sm:inline' : 'inline'}>
        <span className="text-signal-400 border-signal-500/40 rounded border px-1.5 py-0.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase">
          Admin
        </span>
      </span>
      {DATABASE_LABEL && (
        <span
          className="bg-alert-500 text-navy-950 rounded px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase"
          title="Not the live website: changes here do not appear on imagreece.gr."
        >
          {DATABASE_LABEL}
        </span>
      )}
    </span>
  )
}
