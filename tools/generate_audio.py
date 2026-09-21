"""TODO_ART: deterministic original placeholder score and effects. No external samples."""
from pathlib import Path
import math, random, struct, wave, tempfile, subprocess
RATE=22050
ROOT=Path(__file__).resolve().parents[1]/'public'/'audio'
FILES={'ambient/nhalis':24,'music/awakening':24,'boss/obedience':24,'combat/slash':.22,'combat/heavy':.4,'combat/impact':.2,'combat/hurt':.35,'combat/parry':.65,'abilities/dash':.3,'footsteps/jump':.18,'abilities/remanence':1.8,'ui/anchor':1.6,'ui/release':3,'footsteps/stone':.12}
for name,duration in FILES.items():
    rng=random.Random(name); samples=[]
    for i in range(int(RATE*duration)):
        t=i/RATE;noise=rng.uniform(-1,1);fade=min(1,t/.05,(duration-t)/.15)
        if duration==24:
            drone=(math.sin(2*math.pi*55*t)+.4*math.sin(2*math.pi*82.5*t)+.15*math.sin(2*math.pi*110*t))/3
            if name.startswith('ambient'): value=drone*.24+noise*.009
            else:
                notes=[220,261.6256,293.6648,329.6276,246.9417,196,293.6648,164.8138]
                beat=1.5 if name.startswith('music') else .75
                at=t%beat;note=notes[int(t/beat)%len(notes)]
                bell=math.sin(2*math.pi*note*t)*math.exp(-at*2.5)+.15*math.sin(2*math.pi*note*3.01*t)*math.exp(-at*6)
                value=drone*.25+bell*.14
                if name.startswith('boss'): value+=math.sin(2*math.pi*(60-30*at)*t)*math.exp(-at*15)*.25
        else:
            k=t/duration;env=(1-k)**2
            if 'slash' in name or 'dash' in name or 'stone' in name:value=noise*env*.22
            elif 'impact' in name or 'hurt' in name or 'heavy' in name:value=(noise*.25+math.sin(2*math.pi*(90-50*k)*t)*.4)*env
            else:value=sum(math.sin(2*math.pi*f*t)*math.exp(-t*(1.5+j)) for j,f in enumerate([440,659.25,880]))*.14*env
        samples.append(struct.pack('<h',int(max(-.95,min(.95,value*max(0,fade)))*32767)))
    destination=ROOT/(name+'.ogg');destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        source=Path(directory)/'source.wav'
        with wave.open(str(source),'wb') as output:output.setnchannels(1);output.setsampwidth(2);output.setframerate(RATE);output.writeframes(b''.join(samples))
        encoded=Path(directory)/'encoded.ogg'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-c:a','libvorbis','-q:a','3',str(encoded)],check=True)
        if encoded.stat().st_size<100:raise RuntimeError('Empty encoded audio')
        (ROOT/(name+'.wav')).write_bytes(source.read_bytes())
        temporary=destination.with_suffix('.ogg.new');temporary.write_bytes(encoded.read_bytes());temporary.replace(destination)
    print(destination.relative_to(ROOT),destination.stat().st_size)
