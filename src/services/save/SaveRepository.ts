import type { SaveEnvelopeV2, SavePayload } from '../../game/core/save/saveFormat';
export type SaveLoadResult={kind:'empty'}|{kind:'ok';save:SaveEnvelopeV2;persistenceWarning?:string}|{kind:'corrupt';message:string};
export interface SaveRepository {
  load():Promise<SaveLoadResult>;
  save(payload:SavePayload):Promise<SaveEnvelopeV2>;
  clear():Promise<void>;
}
