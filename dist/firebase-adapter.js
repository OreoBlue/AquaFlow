/** Live Firebase Realtime Database read-only adapter. All writes are made by ESP32 / trusted Python services.
 * Uses the Firebase web SDK from Google's CDN only AFTER source has been set to 'firebase'.
 */
import {config} from './config.js';
import {firebaseWebConfig} from './firebase-config.js';
import {normalizeReading,normalizePrediction} from './data-model.js';
export function createFirebaseSource(){
  let callbacks,unsubs=[],authUnsub=null,auth,signInFn,signOutFn,stopped=false;
  const state={latest:null,history:[],prediction:null,predictionHistory:[]};
  const emit=()=>callbacks?.onData({...state});
  const error=e=>callbacks?.onError(e instanceof Error?e:new Error(String(e)));
  const removeListeners=()=>{for(const fn of unsubs.splice(0))try{fn();}catch{}};
  async function start(next){
    callbacks=next;stopped=false;
    if(!Object.values(firebaseWebConfig).every(x=>typeof x==='string'&&x.trim())){
      error(new Error('Konfigurasi Firebase belum diisi pada dist/firebase-config.js.'));return;
    }
    try{
      const [{initializeApp,getApps,getApp},{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut},db]
       =await Promise.all([
         import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
         import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
         import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js'),
       ]);
      if(stopped)return;
      const app=getApps().length?getApp():initializeApp(firebaseWebConfig);
      auth=getAuth(app);signInFn=signInWithEmailAndPassword;signOutFn=signOut;
      const database=db.getDatabase(app),base=`devices/${config.deviceId}`;
      const off=onAuthStateChanged(auth,user=>{
        removeListeners();
        if(!user){Object.assign(state,{latest:null,history:[],prediction:null,predictionHistory:[]});emit();callbacks?.onAuthRequired?.();return;}
        callbacks?.onAuthReady?.(user.email||'Operator');
        const subscribe=(path,receiver,queryOptions)=>{
          const reference=db.ref(database,path);
          const target=queryOptions?db.query(reference,...queryOptions):reference;
          unsubs.push(db.onValue(target,snapshot=>{receiver(snapshot.val());emit();},error));
        };
        subscribe(`${base}/latest`,value=>{state.latest=normalizeReading(value);});
        subscribe(`${base}/history`,value=>{state.history=Object.values(value||{}).map(normalizeReading).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);},
          [db.orderByChild('timestamp'),db.limitToLast(18000)]);
        subscribe(`${base}/predictions/latest`,value=>{state.prediction=normalizePrediction(value);});
        subscribe(`${base}/predictions/history`,value=>{state.predictionHistory=Object.values(value||{}).map(normalizePrediction).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);},
          [db.orderByChild('timestamp'),db.limitToLast(2000)]);
      },error);
      authUnsub=off;
    }catch(e){error(new Error(`Gagal memulai Firebase: ${e.message}`));}
  }
  async function signIn(email,password){if(!auth||!signInFn)throw new Error('Firebase belum siap. Periksa konfigurasi dan koneksi.');await signInFn(auth,email,password);}
  async function signOut(){if(!auth||!signOutFn)throw new Error('Firebase belum siap.');await signOutFn(auth);}
  function stop(){stopped=true;callbacks=null;removeListeners();if(authUnsub)authUnsub();authUnsub=null;}
  return {start,stop,signIn,signOut};
}
