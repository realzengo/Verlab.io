// Pill-shaped fields and buttons on the white form column. Inputs are 16px
// on phones so iOS doesn't zoom on focus, 15px from sm up.
export const AUTH_INPUT_CLASSES =
  "h-12 w-full rounded-full border border-hairline bg-surface px-5 text-base text-heading placeholder:text-subtle/60 transition-[border-color,box-shadow] duration-200 ease-out hover:border-body/25 focus:border-[#335cff] focus:outline-none focus:ring-4 focus:ring-[#335cff]/12 sm:text-[15px]";

export const AUTH_LABEL_CLASSES = "text-[14px] font-medium text-heading";

export const AUTH_OAUTH_BUTTON_CLASSES =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-hairline bg-surface text-[15px] font-medium tracking-[-0.01em] text-heading transition-[background-color,border-color] duration-200 ease-out hover:border-body/20 hover:bg-zinc-50 active:bg-zinc-100 disabled:pointer-events-none disabled:opacity-50";

export const AUTH_PRIMARY_BUTTON_CLASSES =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#5170ff_0%,#335cff_45%,#1d3fc9_100%)] text-[15px] font-semibold tracking-[-0.01em] text-white ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.12),0_1px_2px_rgba(16,24,40,0.08)] transition-[transform,filter] duration-200 ease-out hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50";

// Sign In / Sign Up -- a flat, solid Verlab blue pill. No gradient or glow;
// hover and press each step one shade darker, and a ring appears only for
// keyboard focus.
export const AUTH_SIGNIN_BUTTON_CLASSES =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#335cff] text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors duration-150 ease-out hover:bg-[#2a51f0] active:bg-[#2246d6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#335cff]/25 disabled:pointer-events-none disabled:opacity-60";
