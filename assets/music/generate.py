"""Create six original, locally bundled instrumental miniatures (no samples).

Uses a struck-string additive piano voice, original melodies, arpeggiated chords,
gentle stereo-room echoes mixed to mono, and a final resolving cadence.
Run with Python + NumPy. Files are PCM WAV for broad browser support.
"""
from pathlib import Path
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 22050

# Each melody is independently written in MIDI notes, with its own meter,
# harmony, rhythm, tempo and register. None uses a pre-existing recording.
PIECES = [
    dict(file='01-first-light.wav', title='初见的光', bpm=70, meter=4,
         chords=[(48,52,55,59),(45,48,52,55),(53,57,60,64),(55,59,62,65)],
         melody=[[72,76,79,76],[74,72,69,71],[72,77,76,72],[74,71,67,71],
                 [76,79,81,79],[76,72,69,72],[77,76,72,69],[71,74,72,72]],
         rhythm=[0,1,2,3], pattern=[0,2,1,3,2,1,3,2]),
    dict(file='02-slow-afternoon.wav', title='慢慢的午后', bpm=64, meter=3,
         chords=[(50,54,57,61),(47,50,54,57),(43,47,50,54),(45,49,52,55)],
         melody=[[74,78,81],[78,74,73],[71,74,78],[76,73,69],
                 [78,81,85],[83,78,74],[79,78,74],[73,76,74]],
         rhythm=[0,1,2], pattern=[0,2,1,3,2,1]),
    dict(file='03-under-one-umbrella.wav', title='同一把伞', bpm=76, meter=4,
         chords=[(45,48,52,55),(41,45,48,52),(48,52,55,59),(43,47,50,55)],
         melody=[[69,72,76,74,72],[71,69,65,69,72],[67,72,76,79,76],[74,71,67,71,69],
                 [72,76,81,79,76],[77,76,72,69,65],[76,79,76,72,71],[74,71,69,72,69]],
         rhythm=[0,.75,1.5,2.5,3.25], pattern=[0,1,2,3,1,2,3,2]),
    dict(file='04-evening-by-the-sea.wav', title='海边的晚风', bpm=66, meter=3,
         chords=[(53,57,60,64),(50,53,57,60),(46,50,53,57),(48,52,55,58)],
         melody=[[77,76,72,69],[74,77,81,77],[79,77,74,70],[76,72,67,72],
                 [81,79,77,76],[77,81,84,81],[82,81,77,74],[76,79,77,77]],
         rhythm=[0,.75,1.5,2.25], pattern=[0,2,3,1,2,3]),
    dict(file='05-a-letter-to-you.wav', title='写给你的信', bpm=72, meter=4,
         chords=[(55,59,62,66),(52,55,59,62),(48,52,55,59),(50,54,57,60)],
         melody=[[79,78,74,71],[76,79,78,74],[72,76,79,76],[78,74,69,74],
                 [83,81,79,78],[79,78,76,74],[76,79,84,83],[81,78,79,79]],
         rhythm=[0,1.5,2.5,3.25], pattern=[0,2,1,3,2,3,1,2]),
    dict(file='06-tomorrow-with-you.wav', title='明天也和你', bpm=68, meter=4,
         chords=[(51,55,58,62),(48,51,55,58),(44,48,51,55),(46,50,53,56)],
         melody=[[75,79,82,79,77,75],[72,75,79,77,75,74],[75,80,79,75,72,75],[77,74,70,74,77,75],
                 [79,82,86,84,82,79],[79,75,72,75,79,82],[80,79,75,72,75,79],[77,74,75,79,75,75]],
         rhythm=[0,.5,1.5,2,2.75,3.5], pattern=[0,1,2,3,2,1,3,2]),
]

def render(piece, seed):
    rng = np.random.default_rng(seed)
    beat = 60 / piece['bpm']
    bars = 16
    duration = bars * piece['meter'] * beat + 5
    out = np.zeros(int(duration * SR), np.float64)

    def note(midi, at, hold, volume):
        freq = 440 * 2 ** ((midi - 69) / 12)
        length = min(hold + 2.2, 5.5)
        t = np.arange(int(length * SR)) / SR
        tone = np.zeros_like(t)
        # Inharmonic upper strings decay much faster than the fundamental.
        for harmonic, weight in [(1,1), (2,.28), (3,.12), (4,.055), (5,.025), (7,.01)]:
            decay = (1.65 + 0.5 * (60 / freq)) / (1 + .25 * (harmonic-1))
            pitch = freq * harmonic * (1 + .00006 * harmonic**2)
            env = np.exp(-t / decay)
            tone += weight * env * np.sin(2*np.pi*pitch*t + .015*harmonic)
        attack = 1 - np.exp(-t / .008)
        release = np.exp(-np.maximum(t-hold, 0) / .45)
        tone *= attack * release * volume
        start = max(0, int(at * SR))
        n = min(len(tone), len(out)-start)
        if n > 0: out[start:start+n] += tone[:n]

    for bar in range(bars):
        origin = bar * piece['meter'] * beat + .1
        chord = piece['chords'][bar % 4]
        # Last bar resolves back to the tonic rather than cutting mid-phrase.
        if bar == bars-1: chord = piece['chords'][0]
        note(chord[0]-12, origin, beat*piece['meter']*.85, .16)
        for i, index in enumerate(piece['pattern']):
            jitter = rng.uniform(-.012, .012)
            note(chord[index], origin + i*.5*beat+jitter, beat*.9, .105+rng.uniform(-.012,.012))
        melody = piece['melody'][bar % 8]
        for i, midi in enumerate(melody):
            if bar == bars-1 and i > len(melody)//2: midi = piece['melody'][0][0]
            at = piece['rhythm'][i]
            hold = (piece['rhythm'][i+1]-at if i+1 < len(melody) else piece['meter']-at) * beat
            note(midi, origin + at*beat + .018, max(.2,hold*.94), .19+rng.uniform(-.015,.015))

    dry = out.copy()
    for delay, mix in [(0.127,.09),(.233,.075),(.359,.052),(.511,.035),(.683,.02)]:
        off=int(delay*SR)
        out[off:] += dry[:-off]*mix
    fade_in=min(len(out), int(.08*SR))
    out[:fade_in] *= np.linspace(0,1,fade_in)
    fade=int(2.7*SR)
    out[-fade:] *= np.linspace(1,0,fade)**1.5
    out *= .78/max(1e-6,np.max(np.abs(out)))
    pcm=(np.clip(out,-1,1)*32767).astype('<i2')
    with wave.open(str(ROOT/piece['file']), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    return {'file':piece['file'], 'title':piece['title'], 'duration':round(duration,2), 'bpm':piece['bpm'], 'meter':piece['meter']}

if __name__ == '__main__':
    manifest=[render(piece, 2718+i*101) for i,piece in enumerate(PIECES)]
    (ROOT/'tracks.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
