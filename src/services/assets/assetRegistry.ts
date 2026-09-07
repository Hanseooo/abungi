export function cutoutUrl(assetId:string):string{return `/assets/cutouts/${assetId}.svg`;}
export function regionBackgroundUrl(regionIndex:number):string{return `/assets/backgrounds/region-${Math.min(3,Math.max(1,regionIndex+1))}.svg`;}
export const TITLE_BACKGROUND='/assets/backgrounds/title-stage.svg';
