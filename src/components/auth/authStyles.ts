// Inputs are 16px on phones so iOS doesn't zoom on focus, 15px from sm up.
export const AUTH_INPUT_CLASSES =
  "h-12 w-full rounded-xl border border-hairline bg-surface px-3.5 text-base text-heading placeholder:text-subtle/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-body/25 focus:border-[#0075ff] focus:outline-none focus:ring-4 focus:ring-[#0075ff]/12 sm:text-[15px]";

export const AUTH_LABEL_CLASSES = "text-[13px] font-medium text-heading";

export const AUTH_OAUTH_BUTTON_CLASSES =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-hairline bg-surface text-[15px] font-semibold tracking-[-0.01em] text-heading shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-[background-color,border-color] duration-200 ease-out hover:border-body/20 hover:bg-zinc-50 active:bg-zinc-100 disabled:pointer-events-none disabled:opacity-50";

export const AUTH_PRIMARY_BUTTON_CLASSES =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,#5170ff_0%,#335cff_45%,#1d3fc9_100%)] text-[15px] font-semibold tracking-[-0.01em] text-white ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.12),0_1px_2px_rgba(16,24,40,0.08)] transition-[transform,filter] duration-200 ease-out hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50";

// Sign In / Sign Up -- a flat, solid blue, distinct from
// AUTH_PRIMARY_BUTTON_CLASSES' indigo used by Reset Password. No gradient
// or glow; hover and press each step one shade darker, and a ring appears
// only for keyboard focus.
export const AUTH_SIGNIN_BUTTON_CLASSES =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#005bd1] bg-[#0068e8] text-[15px] font-semibold tracking-[-0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(16,24,40,0.12)] transition-colors duration-150 ease-out hover:bg-[#005fd6] active:bg-[#0055c2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0075ff]/20 disabled:pointer-events-none disabled:opacity-60";
