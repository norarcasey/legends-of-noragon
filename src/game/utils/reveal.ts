/** Add `room` to the revealed set (returning the same array if already known). */
export function reveal(revealedRooms: number[], room: number | null): number[] {
  if (room === null || revealedRooms.includes(room)) return revealedRooms
  return [...revealedRooms, room]
}
