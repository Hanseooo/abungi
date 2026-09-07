import type { SaveEnvelopeV1, SavePayload } from '../../game/core/save/saveFormat';
export type SaveLoadResult={kind:'empty'}|{kind:'ok';save:SaveEnvelopeV1}|{kind:'corrupt';message:string};
export interface SaveRepository {
  load():Promise<SaveLoadResult>;
  save(payload:SavePayload):Promise<SaveEnvelopeV1>;
  clear():Promise<void>;
}
