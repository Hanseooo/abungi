import type { SaveRepository } from './SaveRepository';
import { IndexedDbSaveRepository } from './IndexedDbSaveRepository';
export function createSaveRepository():SaveRepository{return new IndexedDbSaveRepository();}
