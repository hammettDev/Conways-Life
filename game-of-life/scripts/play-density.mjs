import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation, RED_LOS_X, CENTER_Y } from '../src/engine/formations.js';
import { RED } from '../src/engine/constants.js';
const ids = FREE_BUILDS.filter(b=>/^fb-(4-3|dime|46|cover|tampa|goal-line-d|prevent|nickel)/.test(b.id));
console.log('defence'.padEnd(16),'box(<=4)','mid(5-11)','deep(12+)','lanes covered mid','lanes covered deep');
for (const b of ids) {
  const cells = placeFormation({players:b.players.filter(p=>p.role!=='RS')}, RED);
  const d = c => c.x - RED_LOS_X;
  const box = cells.filter(c=>d(c)<=4).length, mid = cells.filter(c=>d(c)>=5&&d(c)<=11).length, deep = cells.filter(c=>d(c)>=12).length;
  const lanes = [];for(let l=-20;l<=20;l+=2)lanes.push(CENTER_Y+l);
  const cov=(lo,hi)=>Math.round(100*lanes.filter(y=>cells.some(c=>d(c)>=lo&&d(c)<=hi&&Math.abs(c.y-y)<=3)).length/lanes.length);
  console.log(b.id.padEnd(16),String(box).padEnd(8),String(mid).padEnd(9),String(deep).padEnd(9),(cov(5,11)+'%').padEnd(17),cov(12,40)+'%');
}
