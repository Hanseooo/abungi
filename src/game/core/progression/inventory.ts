import { BALANCE } from '../../balance/constants.js';
import type { RunState } from '../types.js';

export function inventoryCount(run:Pick<RunState,'inventory'>):number{
  return run.inventory.reduce((sum,entry)=>sum+entry.quantity,0);
}

export function inventoryCapacity(run:Pick<RunState,'relicIds'>):number{
  return BALANCE.inventoryCapacity+(run.relicIds.includes('deep-pockets')?1:0);
}
