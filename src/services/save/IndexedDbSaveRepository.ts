import { createSaveEnvelope, migrateSaveEnvelope, type SaveEnvelopeV3, type SavePayload } from '../../game/core/save/saveFormat';
import { parseSaveEnvelope } from './schema';
import type { SaveLoadResult, SaveRepository } from './SaveRepository';

const DB_NAME='abungi-save';const STORE='snapshots';const KEY='primary';

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Could not open local save storage.'));
  });
}
function requestResult<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Local save operation failed.'));});}

async function writebackMigrated(migrated:SaveEnvelopeV3):Promise<void>{
  const db=await openDb();
  const tx=db.transaction(STORE,'readwrite');
  await requestResult(tx.objectStore(STORE).put(migrated,KEY));
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??new Error('Migration writeback failed.'));tx.onabort=()=>reject(tx.error??new Error('Migration writeback cancelled.'));});
  db.close();
}

export class IndexedDbSaveRepository implements SaveRepository{
  async load():Promise<SaveLoadResult>{
    try{
      const db=await openDb();const tx=db.transaction(STORE,'readonly');const raw=await requestResult(tx.objectStore(STORE).get(KEY));db.close();
      if(raw===undefined)return{kind:'empty'};
      try{
        const migrated=migrateSaveEnvelope(raw);
        const save=parseSaveEnvelope(migrated);
        // Write back only if we actually migrated (version changed)
        if((raw as {schemaVersion?:unknown}).schemaVersion!==2){
          try{await writebackMigrated(save);}
          catch(e){
            const persistenceWarning='Save format updated but could not be persisted. Progress will save normally going forward.';
            return{kind:'ok',save,persistenceWarning};
          }
        }
        return{kind:'ok',save};
      }
      catch(error){return{kind:'corrupt',message:error instanceof Error?error.message:'The local save could not be read.'};}
    }catch(error){return{kind:'corrupt',message:error instanceof Error?error.message:'Local storage is unavailable.'};}
  }
  async save(payload:SavePayload):Promise<SaveEnvelopeV3>{
    const current=await this.load();const revision=current.kind==='ok'?current.save.revision+1:1;const envelope=parseSaveEnvelope(createSaveEnvelope(payload,revision));
    const db=await openDb();const tx=db.transaction(STORE,'readwrite');await requestResult(tx.objectStore(STORE).put(envelope,KEY));
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??new Error('Local save commit failed.'));tx.onabort=()=>reject(tx.error??new Error('Local save commit was cancelled.'));});db.close();return envelope;
  }
  async clear():Promise<void>{const db=await openDb();const tx=db.transaction(STORE,'readwrite');await requestResult(tx.objectStore(STORE).delete(KEY));db.close();}
}
