import { CFG, speedAt } from './config';
import { Game } from './game';

/**
 * Reference player used by the automated tests: follows the generator's safe
 * lane and times jumps/slides. If the bot dies, the course was not fair.
 */
export function botStep(g: Game): void {
  const p = g.player;
  const rows = g.track.rows;
  let i = 0;
  while (i < rows.length && rows[i].z < g.dist - 0.4) i++;
  const row = rows[i];
  if (!row) return;
  const prev = rows[i - 1];
  // After a row with holes, wait until the holes are behind: crossing a hole lane on the ground is a fall
  const clearOfPrev = !prev || g.dist > prev.z + (prev.cells.includes('gap') ? prev.gapLen / 2 + 0.3 : 1.2);
  const lane = row.safe - 1;
  if (clearOfPrev && p.lane !== lane) g.act(p.lane < lane ? 'right' : 'left');
  const cell = row.cells[row.safe];
  const ahead = row.z - g.dist;
  const v = speedAt(g.dist);
  if ((cell === 'low' || cell === 'gap') && p.state === 'run' && ahead <= v * 0.3) g.act('up');
  if (cell === 'high' && p.state === 'run' && ahead <= v * 0.22 + 0.6) g.act('down');
  void CFG;
}
