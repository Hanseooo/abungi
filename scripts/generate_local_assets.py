from pathlib import Path
from math import sin, pi
import wave, struct, random
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
CUT=ROOT/'public/assets/cutouts'; BG=ROOT/'public/assets/backgrounds'; ICON=ROOT/'public/assets/icons'; AUDIO=ROOT/'public/audio'
for p in (CUT,BG,ICON,AUDIO): p.mkdir(parents=True,exist_ok=True)

paper='#F2E7D5'; ink='#1E1A17'; cardboard='#C7A679'
palette=['#A9463B','#247B78','#C9962E','#6E7B4B','#6C4A78','#43546A','#8C5A3C','#4A715A']
assets=[
('character-earl',0,'medic'),('character-greg',2,'cutlass'),('character-michael',5,'rifle'),('character-marcus',1,'shield'),('character-hans',3,'wrench'),('character-yeeho',4,'dice'),('character-jiro',2,'pan'),('character-nathaniel',4,'shade'),('character-yatords',1,'wheel'),('character-daboy',6,'bottle'),('character-leandre',3,'coins'),('character-saq',1,'pointer'),('character-ken',5,'needle'),
('enemy-scrapper',6,'fists'),('enemy-road-dog',0,'speed'),('enemy-cutpurse',4,'knife'),('enemy-smokehead',3,'smoke'),('enemy-hexling',4,'shade'),('enemy-wisp',4,'wisp'),('enemy-dronelet',1,'drone'),('enemy-bulwark-bot',5,'shield'),('enemy-backstreet-medic',3,'medic'),('enemy-tin-brute',6,'brute'),
('elite-broker',4,'coins'),('elite-ironclad',5,'brute'),('elite-night-maw',4,'maw'),('boss-jonlow',2,'glutton'),('boss-klyde',0,'chaos'),('boss-warden',5,'warden')]

props={
 'medic':'<path d="M98 92h28M112 78v28"/>',
 'cutlass':'<path d="M145 90q28 26 1 70M141 88l8-7"/>',
 'rifle':'<path d="M136 98l47 15-4 10-48-12M169 112l-4 25"/>',
 'shield':'<path d="M142 86l30 10-4 48q-11 19-29 24-15-21-13-55z"/>',
 'wrench':'<path d="M144 86q18-18 31-3l-13 12 16 46-11 4-17-45-17-2q0-9 11-12z"/>',
 'dice':'<rect x="143" y="94" width="35" height="35" rx="3"/><circle cx="151" cy="102" r="2"/><circle cx="169" cy="120" r="2"/><circle cx="160" cy="111" r="2"/>',
 'pan':'<ellipse cx="157" cy="112" rx="20" ry="17"/><path d="M139 126l-29 31"/>',
 'shade':'<path d="M68 118q-22 20-4 47M151 119q27 13 14 50"/><path d="M99 60q14-25 27 0"/>',
 'wheel':'<circle cx="157" cy="132" r="29"/><circle cx="157" cy="132" r="5"/><path d="M157 103v58M128 132h58M136 111l42 42M178 111l-42 42"/>',
 'bottle':'<path d="M150 85h12v24q14 12 12 41h-36q-2-29 12-41z"/>',
 'coins':'<ellipse cx="156" cy="117" rx="19" ry="9"/><ellipse cx="166" cy="132" rx="19" ry="9"/><ellipse cx="145" cy="143" rx="18" ry="8"/>',
 'fists':'<path d="M54 112q-18 8-10 25l20 10M164 110q23 7 16 25l-20 11"/>',
 'speed':'<path d="M41 106h38M35 121h33M45 136h28"/>',
 'knife':'<path d="M146 97l38-21-24 35-11 3z"/>',
 'smoke':'<path d="M158 84q22-18 9-36q26 8 15-20M163 90q29-7 25-28"/>',
 'wisp':'<path d="M106 61q-40 44-4 76q20 17 8 51q54-24 41-77q-8-33-45-50z"/>',
 'drone':'<path d="M68 97h87v38H68zM50 89l25 18M172 89l-25 18M50 144l25-19M172 144l-25-19"/><circle cx="51" cy="88" r="13"/><circle cx="173" cy="88" r="13"/>',
 'brute':'<path d="M51 92q54-47 111 0l25 86H28z"/>',
 'maw':'<path d="M61 103q49-48 101 0q-9 73-51 76-42-3-50-76z"/><path d="M76 121q36 35 72 0M84 125l7 17M139 125l-8 17"/>',
 'glutton':'<ellipse cx="112" cy="125" rx="63" ry="58"/><path d="M71 128q41 29 82 0"/>',
 'chaos':'<path d="M55 76l24 16-18 18 22 20-29 34M169 72l-24 20 19 18-23 21 30 31"/>',
 'warden':'<path d="M69 65h87v24l18 22-17 81H67l-18-81 20-22z"/><path d="M91 80h42M93 104h38M111 105v63"/>',
 'pointer':'<path d="M143 88l38 12-4 10-36-10z"/><rect x="132" y="96" width="14" height="46" rx="3"/><path d="M126 150h30"/>',
 'needle':'<path d="M148 84l30 10-6 12-28-8z"/><path d="M144 100l-9 44M152 102l-6 44"/><circle cx="139" cy="152" r="6"/>',
}

def svg_asset(name,idx,prop):
    color=palette[idx%len(palette)]
    enemy=name.startswith('enemy') or name.startswith('elite') or name.startswith('boss')
    boss=name.startswith('boss'); elite=name.startswith('elite')
    body = '<path d="M76 78q35-20 70 0l18 82q-52 29-105 0z"/>' if not enemy else ('<path d="M60 77q51-31 101 0l24 98q-73 30-146 0z"/>' if boss else '<path d="M68 83q44-27 87 0l20 87q-63 27-126 0z"/>')
    head = '<path d="M87 53q24-26 50 0v32H87z"/>' if not enemy else '<path d="M82 55q30-31 60 0l-6 35H88z"/>'
    deco=props.get(prop,'')
    # Prop linework is dark, figure fill has subtle print texture.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 224">
<defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="{idx+3}" result="n"/><feBlend in="SourceGraphic" in2="n" mode="multiply"/></filter></defs>
<g stroke="{ink}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
<ellipse cx="112" cy="198" rx="73" ry="10" fill="#1E1A1720" stroke="none"/>
<g fill="{color}" filter="url(#grain)">{body}{head}</g>
<path d="M83 166l-11 31M143 166l12 31" fill="none"/>
<path d="M74 96L46 139M150 97l29 43" fill="none"/>
<g fill="{paper}" stroke-width="6">{deco}</g>
<path d="M94 69h7M123 69h7"/>
</g>
<path d="M66 178q48 15 96-1" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="4"/>
</svg>'''
for name,idx,prop in assets:(CUT/f'{name}.svg').write_text(svg_asset(name,idx,prop))

# Layered theatre backgrounds with no embedded text.
def bg(region,colors):
    a,b,c=colors
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
<defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="{region+20}"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer></filter></defs>
<rect width="1200" height="800" fill="{paper}"/><path d="M0 205L170 130l240 45 205-95 275 85 310-47v682H0z" fill="{a}" stroke="{ink}" stroke-width="9"/>
<path d="M0 410l210-75 198 45 260-100 240 93 292-55v482H0z" fill="{b}" stroke="{ink}" stroke-width="8"/>
<path d="M0 610q180-88 360 0t360 0 360 0 120 0v190H0z" fill="{c}" stroke="{ink}" stroke-width="8"/>
<g opacity=".28" stroke="{ink}" stroke-width="6" fill="none"><path d="M110 288h270M732 232h315M131 497h180M826 470h224"/><path d="M516 344l42-42 42 42-42 42zM951 583l38-38 38 38-38 38z"/></g><rect width="1200" height="800" filter="url(#grain)"/></svg>'''
(BG/'region-1.svg').write_text(bg(1,('#D0B183','#8AA16E','#B36A4F')))
(BG/'region-2.svg').write_text(bg(2,('#8D7568','#5F7F77','#6C4A78')))
(BG/'region-3.svg').write_text(bg(3,('#7F7567','#536568','#3F444A')))
(BG/'title-stage.svg').write_text(bg(0,('#C7A679','#A9463B','#247B78')))

# PWA icons, hand-cut AB monogram built from polygons/lines.
for size in (192,512):
    im=Image.new('RGB',(size,size),(242,231,213));d=ImageDraw.Draw(im)
    pad=size*.08;d.rounded_rectangle((pad,pad,size-pad,size-pad),radius=size*.08,fill=(199,166,121),outline=(30,26,23),width=max(3,size//48))
    # A
    w=max(5,size//28);d.line((size*.25,size*.68,size*.39,size*.30,size*.53,size*.68),fill=(30,26,23),width=w,joint='curve');d.line((size*.31,size*.54,size*.47,size*.54),fill=(30,26,23),width=w)
    # B
    d.line((size*.59,size*.30,size*.59,size*.69),fill=(30,26,23),width=w);d.arc((size*.51,size*.28,size*.78,size*.52),-90,90,fill=(169,70,59),width=w);d.arc((size*.50,size*.47,size*.80,size*.72),-90,90,fill=(36,123,120),width=w)
    im.save(ICON/f'icon-{size}.png',optimize=True)

# Audio synthesis: short tactile UI/percussion sounds + compact looping cues. Original generated signals, no external assets.
RATE=22050

def env(i,n,attack=.03):
    t=i/n; a=min(1,t/max(attack,1e-4)); r=min(1,(1-t)/.18); return max(0,min(a,r))
def write_wav(name,dur,func,volume=.35):
    n=max(1,int(RATE*dur));frames=[]
    for i in range(n):
        v=max(-1,min(1,func(i/RATE,i,n)*env(i,n)))*volume
        frames.append(struct.pack('<h',int(v*32767)))
    with wave.open(str(AUDIO/name),'wb') as wf:wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(RATE);wf.writeframes(b''.join(frames))

def tone(freq,kind='sine'):
    if kind=='square':return lambda t,i,n: 1 if sin(2*pi*freq*t)>=0 else -1
    return lambda t,i,n:sin(2*pi*freq*t)
def mix(*funcs):return lambda t,i,n:sum(f(t,i,n) for f in funcs)/len(funcs)
write_wav('ui-click.wav',.10,mix(tone(520),tone(760)),.22)
write_wav('confirm.wav',.18,lambda t,i,n:sin(2*pi*(480+620*t)*t),.25)
write_wav('cancel.wav',.16,lambda t,i,n:sin(2*pi*(520-230*t)*t),.22)
write_wav('error.wav',.22,mix(tone(145,'square'),tone(176)),.20)
write_wav('hit.wav',.13,lambda t,i,n:(random.Random(i*17+3).random()*2-1)*(.7 if t<.05 else .25)+sin(2*pi*105*t),.28)
write_wav('heavy-hit.wav',.25,lambda t,i,n:(random.Random(i*31+7).random()*2-1)*(.6 if t<.08 else .13)+sin(2*pi*72*t),.38)
write_wav('heal.wav',.55,lambda t,i,n:(sin(2*pi*392*t)+sin(2*pi*523.25*t)+sin(2*pi*659.25*t))/3,.22)
write_wav('status.wav',.34,lambda t,i,n:sin(2*pi*(250+700*t)*t),.18)
write_wav('coin.wav',.25,mix(tone(1200),tone(1650)),.20)
write_wav('dice.wav',.48,lambda t,i,n:(random.Random(i//120+10).random()*2-1)*(1 if (i//700)%2==0 else .45),.16)
write_wav('summon.wav',.58,lambda t,i,n:(sin(2*pi*(180+520*t)*t)+sin(2*pi*(360+260*t)*t))/2,.25)
write_wav('victory.wav',1.4,lambda t,i,n:sum(sin(2*pi*f*t) for f in ([261.6,329.6,392,523.2] if t>.65 else [261.6,329.6,392]))/4,.23)
write_wav('defeat.wav',1.3,lambda t,i,n:(sin(2*pi*(220-70*t)*t)+sin(2*pi*(164-50*t)*t))/2,.22)
write_wav('shop.wav',.48,lambda t,i,n:(sin(2*pi*659*t)+sin(2*pi*784*t))/2,.18)

notes=[146.8,174.6,196.0,220.0,196.0,174.6,164.8,174.6]
def music_func(boss=False):
    def f(t,i,n):
        beat=int(t*2.5)%len(notes);freq=notes[beat]*(.75 if boss else 1);lead=sin(2*pi*freq*t)*.55
        bass=sin(2*pi*(freq/2)*t)*.32
        pulse=(1 if sin(2*pi*(2.5 if not boss else 3.2)*t)>0 else -1)*.12
        return lead+bass+pulse
    return f
write_wav('battle-music.wav',12,music_func(False),.15)
write_wav('boss-music.wav',12,music_func(True),.18)
print(f'generated {len(assets)} cutouts, 4 backgrounds, 2 icons, {len(list(AUDIO.glob("*.wav")))} audio files')
