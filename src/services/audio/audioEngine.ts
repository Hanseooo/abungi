import type { SettingsState } from '../../game/core/types';
export type SfxId='ui-click'|'confirm'|'cancel'|'error'|'hit'|'heavy-hit'|'heal'|'status'|'coin'|'dice'|'summon'|'victory'|'defeat'|'shop';
export type MusicId='battle-music'|'boss-music';
class AudioEngine{
  private settings:SettingsState={masterMuted:false,musicVolume:.55,sfxVolume:.75,animationSpeed:2,reducedMotion:false};
  private unlocked=false;private music:HTMLAudioElement|null=null;private current:MusicId|null=null;
  configure(settings:SettingsState){
    this.settings=settings;
    if(this.music)this.music.volume=settings.masterMuted?0:settings.musicVolume*.52;
    if(settings.masterMuted&&this.music){this.music.pause();this.music=null;}
    if(!settings.masterMuted&&settings.musicVolume>0&&this.unlocked&&this.current&&!this.music){const wanted=this.current;this.current=null;void this.musicTrack(wanted);}
  }
  unlock(){this.unlocked=true;if(this.current&&!this.music&&!this.settings.masterMuted&&this.settings.musicVolume>0){const wanted=this.current;this.current=null;void this.musicTrack(wanted);}}
  async sfx(id:SfxId){if(!this.unlocked||this.settings.masterMuted||this.settings.sfxVolume<=0)return;try{const audio=new Audio(`/audio/${id}.wav`);audio.volume=Math.min(1,this.settings.sfxVolume*.72);await audio.play();}catch{/* Audio failure is deliberately non-fatal. */}}
  async musicTrack(id:MusicId|null){if(this.current===id)return;this.stopMusic();if(!id||!this.unlocked||this.settings.masterMuted||this.settings.musicVolume<=0){this.current=id;return;}try{const audio=new Audio(`/audio/${id}.wav`);audio.loop=true;audio.volume=this.settings.musicVolume*.52;this.music=audio;this.current=id;await audio.play();}catch{this.music=null;this.current=null;}}
  stopMusic(){if(this.music){this.music.pause();this.music.currentTime=0;}this.music=null;this.current=null;}
}
export const audioEngine=new AudioEngine();
