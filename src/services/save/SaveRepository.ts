import type { SaveEnvelopeV3, SavePayload } from '../../game/core/save/saveFormat';
export type SaveLoadResult={kind:'empty'}|{kind:'ok';save:SaveEnvelopeV3;persistenceWarning?:string}|{kind:'corrupt';message:string};
export interface SaveRepository {
  load():Promise<SaveLoadResult>;
  save(payload:SavePayload):Promise<SaveEnvelopeV3>;
  clear():Promise<void>;
}
