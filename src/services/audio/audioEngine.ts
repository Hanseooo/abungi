import type { CombatEvent, SettingsState } from '../../game/core/types';

export type SfxId=
  |'ui-click'|'confirm'|'cancel'|'error'|'hit'|'heavy-hit'|'heal'|'status'|'coin'|'dice'|'summon'|'victory'|'defeat'|'shop'
  |'slash'|'projectile'|'block'|'trigger'|'revive'|'buff'|'debuff'|'item'|'purchase'|'reward';
export type MusicId='exploration-music'|'battle-music'|'boss-music';

type AudioFactory=(src:string)=>HTMLAudioElement;
const MUSIC_GAIN=.52;
const SFX_GAIN=.72;
const FADE_MS=320;
const SFX_LIMIT=8;
const SAME_SFX_GAP_MS=28;

const SFX_SOURCE:Record<SfxId,{file:string;rate?:number;gain?:number}>={
  'ui-click':{file:'ui-click'},confirm:{file:'confirm'},cancel:{file:'cancel'},error:{file:'error'},
  hit:{file:'hit'},'heavy-hit':{file:'heavy-hit'},heal:{file:'heal'},status:{file:'status'},coin:{file:'coin'},dice:{file:'dice'},
  summon:{file:'summon'},victory:{file:'victory'},defeat:{file:'defeat'},shop:{file:'shop'},
  slash:{file:'hit',rate:.86},projectile:{file:'hit',rate:1.35},block:{file:'heavy-hit',rate:.72,gain:.78},
  trigger:{file:'summon',rate:1.22,gain:.7},revive:{file:'heal',rate:.82,gain:1.08},buff:{file:'status',rate:1.2},
  debuff:{file:'status',rate:.82},item:{file:'confirm',rate:.9},purchase:{file:'shop'},reward:{file:'coin',rate:.9},
};

export class AudioEngine{
  private settings:SettingsState={masterMuted:false,musicVolume:.55,sfxVolume:.75,animationSpeed:1,reducedMotion:false};
  private unlocked=false;
  private suspended=false;
  private music:HTMLAudioElement|null=null;
  private desiredMusic:MusicId|null=null;
  private fadeTimer:ReturnType<typeof setInterval>|null=null;
  private activeSfx=new Set<HTMLAudioElement>();
  private lastSfxAt=new Map<SfxId,number>();

  constructor(private readonly createAudio:AudioFactory=(src)=>new Audio(src)){}

  configure(settings:SettingsState){
    this.settings=settings;
    if(this.music)this.music.volume=this.canPlayMusic()?settings.musicVolume*MUSIC_GAIN:0;
    if(!this.canPlayMusic())this.music?.pause();
    else if(this.music){void this.safePlay(this.music);}
    else if(this.desiredMusic){void this.startMusic(this.desiredMusic);}
  }

  unlock(){
    this.unlocked=true;
    if(this.desiredMusic&&!this.music&&this.canPlayMusic())void this.startMusic(this.desiredMusic);
  }

  setSuspended(suspended:boolean){
    if(this.suspended===suspended)return;
    this.suspended=suspended;
    if(suspended)this.music?.pause();
    else if(this.music&&this.canPlayMusic())void this.safePlay(this.music);
    else if(this.desiredMusic&&this.canPlayMusic())void this.startMusic(this.desiredMusic);
  }

  async sfx(id:SfxId){
    if(!this.unlocked||this.suspended||this.settings.masterMuted||this.settings.sfxVolume<=0||this.activeSfx.size>=SFX_LIMIT)return;
    const now=Date.now();
    if(now-(this.lastSfxAt.get(id)??-Infinity)<SAME_SFX_GAP_MS)return;
    this.lastSfxAt.set(id,now);
    const source=SFX_SOURCE[id];
    try{
      const audio=this.createAudio(`/audio/${source.file}.wav`);
      audio.volume=Math.min(1,this.settings.sfxVolume*SFX_GAIN*(source.gain??1));
      audio.playbackRate=source.rate??1;
      this.activeSfx.add(audio);
      const release=()=>{this.activeSfx.delete(audio);audio.removeEventListener('ended',release);audio.removeEventListener('error',release);};
      audio.addEventListener('ended',release);
      audio.addEventListener('error',release);
      await audio.play().catch(()=>{release();});
    }catch{/* Audio creation and playback failures are deliberately non-fatal. */}
  }

  async combatSfx(events:CombatEvent[]){
    const ids:SfxId[]=[];
    if(events.some(event=>event.type==='victory'))ids.push('victory');
    else if(events.some(event=>event.type==='defeat'))ids.push('defeat');
    else{
      const action=events.find(event=>event.type==='actionStart');
      if(events.some(event=>event.type==='hit'&&event.heavy)||action?.type==='actionStart'&&action.choreography==='heavy')ids.push('heavy-hit');
      else if(events.some(event=>event.type==='hit'))ids.push(action?.type==='actionStart'&&action.choreography==='ranged'?'projectile':action?.type==='actionStart'&&action.choreography==='melee'?'slash':'hit');
      if(events.some(event=>event.type==='heal'))ids.push('heal');
      if(events.some(event=>event.type==='revive'))ids.push('revive');
      if(events.some(event=>event.type==='statusApplied'||event.type==='statusRemoved'||event.type==='effectApplied'||event.type==='effectRemoved'))ids.push('status');
      if(events.some(event=>event.type==='guard'||event.type==='prevented'))ids.push('block');
      if(events.some(event=>event.type==='deployableTrigger'))ids.push('trigger');
      if(events.some(event=>event.type==='summon'))ids.push('summon');
      if(events.some(event=>event.type==='coin'))ids.push('coin');
    }
    await Promise.all([...new Set(ids)].slice(0,3).map(id=>this.sfx(id)));
  }

  async musicTrack(id:MusicId|null){
    if(this.desiredMusic===id)return;
    this.desiredMusic=id;
    if(!id){this.stopMusic();return;}
    if(!this.canPlayMusic())return;
    await this.startMusic(id);
  }

  stopMusic(){
    this.desiredMusic=null;
    this.cancelFade();
    if(this.music){this.music.pause();this.music.currentTime=0;}
    this.music=null;
  }

  private canPlayMusic(){return this.unlocked&&!this.suspended&&!this.settings.masterMuted&&this.settings.musicVolume>0;}

  private async startMusic(id:MusicId){
    const previous=this.music;
    this.cancelFade();
    try{
      const next=this.createAudio(`/audio/${id}.wav`);
      next.loop=true;
      next.volume=previous?0:this.settings.musicVolume*MUSIC_GAIN;
      this.music=next;
      await next.play();
      if(previous)this.crossfade(previous,next);
    }catch{
      if(this.music!==previous)this.music=previous;
    }
  }

  private crossfade(previous:HTMLAudioElement,next:HTMLAudioElement){
    const started=Date.now();
    const target=this.settings.musicVolume*MUSIC_GAIN;
    this.fadeTimer=setInterval(()=>{
      const progress=Math.min(1,(Date.now()-started)/FADE_MS);
      next.volume=target*progress;
      previous.volume=target*(1-progress);
      if(progress>=1){previous.pause();previous.currentTime=0;this.cancelFade();}
    },32);
  }

  private cancelFade(){if(this.fadeTimer!==null){clearInterval(this.fadeTimer);this.fadeTimer=null;}}
  private async safePlay(audio:HTMLAudioElement){try{await audio.play();}catch{/* Audio playback remains optional. */}}
}

export const audioEngine=new AudioEngine();
