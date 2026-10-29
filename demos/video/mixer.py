"""Assemble vidéo + voix off + musique (musique baissée sous la voix).
Usage : python3 mixer.py <dossier_videos> <nom> <musique.wav> <sortie.mp4>"""
import json, subprocess, sys

D, NAME, MUSIC, OUT = sys.argv[1:5]
m = json.load(open(f'{D}/{NAME}_marks.json'))
video = f'{D}/{NAME}.mp4'
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).decode().strip())
inputs = ['-i', video, '-i', MUSIC]
parts, labels = [], []
for k, mk in enumerate(m['marks']):
    inputs += ['-i', m['files'][mk['i']]]
    ms = int(mk['t'] * 1000)
    parts.append(f"[{k + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume=1.6[v{k}]")
    labels.append(f'[v{k}]')
n = len(labels)
fc = ';'.join(parts) + ';' + ''.join(labels) + f"amix=inputs={n}:normalize=0:dropout_transition=0,apad[voice];" \
     "[voice]asplit=2[vo][sc];" \
     "[1:a]volume=0.55[mus];" \
     "[mus][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];" \
     f"[vo][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:{dur:.3f}[a]"
tmp = OUT.replace('.mp4', '.tmp.mp4')
subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
                       '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', tmp])
import os
os.replace(tmp, OUT)
print('ok', OUT, round(dur, 1), 's')
