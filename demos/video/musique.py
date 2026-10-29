"""Musique de fond originale, joyeuse et légère (synthèse, libre de droits).
Usage : python3 musique.py <sortie.wav> <durée_s> <tonalité: C|F|G>"""
import sys
import numpy as np, soundfile as sf

OUT, DUR, KEY = sys.argv[1], float(sys.argv[2]), (sys.argv[3] if len(sys.argv) > 3 else 'C')
SR = 44100
BPM = 104
beat = 60 / BPM
n = int(DUR * SR)
t_all = np.arange(n) / SR
mix = np.zeros((n, 2))

root = {'C': 48, 'F': 53, 'G': 55}[KEY]
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
# I – V – vi – IV
prog = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]

def env(length, a=0.01, r=0.3):
    t = np.arange(length) / SR
    e = np.minimum(1, t / a) * np.exp(-t / r)
    return e

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= n:
        return
    sig = sig[: n - i]
    mix[i:i + len(sig), 0] += sig * gain * (1 - pan) * 0.5
    mix[i:i + len(sig), 1] += sig * gain * (1 + pan) * 0.5

def pluck(f, length=0.5, bright=3):
    m = int(length * SR); t = np.arange(m) / SR
    s = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.6 for h in range(1, bright + 1))
    return s * env(m, 0.004, length / 3.5)

def pad(freqs, length):
    m = int(length * SR); t = np.arange(m) / SR
    s = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs)
    a = np.minimum(1, t / 0.4) * np.minimum(1, (length - t) / 0.4)
    return s * a / len(freqs)

def kick():
    m = int(0.35 * SR); t = np.arange(m) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

rng = np.random.default_rng(7)
def shaker():
    m = int(0.08 * SR)
    s = rng.standard_normal(m) * env(m, 0.002, 0.025)
    return np.convolve(s, [1, -0.9], 'same')

def clap():
    m = int(0.2 * SR)
    return rng.standard_normal(m) * env(m, 0.001, 0.06) * 0.6

bar = 4 * beat
nbars = int(DUR / bar) + 1
for b in range(nbars):
    ch = prog[b % 4]
    t0 = b * bar
    add(pad([midi(root + 12 + x) for x in ch], bar + 0.2), t0, 0.16)
    add(pluck(midi(root - 12 + ch[0]), 0.9, 2), t0, 0.5)
    add(pluck(midi(root - 12 + ch[0]), 0.5, 2), t0 + 2.5 * beat, 0.35)
    # motif façon marimba
    pat = [0, 2, 1, 2, 0, 1, 2, 1]
    for k in range(8):
        if (b + k) % 7 == 3:
            continue
        note = root + 24 + ch[pat[k]] + (12 if k == 6 else 0)
        add(pluck(midi(note), 0.35, 4), t0 + k * beat / 2, 0.16, pan=(-0.35 if k % 2 else 0.35))
    for q in range(4):
        add(kick(), t0 + q * beat, 0.55 if q in (0, 2) else 0.3)
        if q in (1, 3):
            add(clap(), t0 + q * beat, 0.22)
    for s16 in range(8):
        add(shaker(), t0 + s16 * beat / 2 + beat / 4, 0.12 + 0.05 * (s16 % 2), pan=0.4)

# fondu entrée / sortie
fade = np.minimum(1, t_all / 1.0) * np.minimum(1, (DUR - t_all) / 2.0)
mix *= fade[:, None]
mix /= max(1e-6, np.abs(mix).max()) / 0.8
sf.write(OUT, mix, SR)
print('musique', OUT, DUR, 's')
