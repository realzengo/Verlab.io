import { ChessBishop, ChessKing, ChessKnight, ChessPawn, ChessQueen, ChessRook, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Every user is a piece on the board: one of six pieces on an ivory or an
// ebony tile, picked from their name so the same person is the same piece in
// every table. The king on the accent tile is kept for the admin themselves.
const PIECES: LucideIcon[] = [ChessPawn, ChessKnight, ChessBishop, ChessRook, ChessQueen, ChessKing];

export type BoardSide = "ivory" | "ebony";

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The piece and side a name lands on. */
export function pieceFor(name: string): { Piece: LucideIcon; side: BoardSide } {
  const h = hash(name.trim().toLowerCase() || "?");
  return { Piece: PIECES[h % PIECES.length], side: (h >>> 8) % 2 === 0 ? "ivory" : "ebony" };
}

const SIZES = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

/**
 * A user's mark in the admin: a chess piece on a small ivory or ebony tile.
 * No initials -- the name always sits beside it. `you` gives the admin's own
 * avatar the king on the accent tile.
 */
export function UserAvatar({
  name,
  size = "sm",
  you = false,
  className,
  label,
}: {
  name: string;
  size?: keyof typeof SIZES;
  you?: boolean;
  className?: string;
  /** Accessible name when the avatar stands alone; omitted, it's decorative. */
  label?: string;
}) {
  const { Piece, side } = you ? { Piece: ChessKing, side: "accent" as const } : pieceFor(name);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative flex shrink-0 items-center justify-center rounded-full", `admin-piece-${side}`, SIZES[size], className)}
    >
      <Piece className="h-[56%] w-[56%]" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}

/** A strip of board squares in the user's side, for the profile card banner. */
export function UserBoard({ name, className }: { name: string; className?: string }) {
  const { side } = pieceFor(name);
  return <div aria-hidden="true" className={cn(`admin-board-${side}`, className)} />;
}
