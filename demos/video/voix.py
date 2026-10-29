"""Génère la voix off (français) de chaque vidéo, une piste par phrase.
Usage : python3 voix.py <dossier_sortie>"""
import json, sys, os
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

OUT = sys.argv[1]
TEL = "zéro soixante-seize, trente-sept, zéro huit, quatre-vingt-un"
SCRIPTS = {
    'caisse': [
        "Votre famille cotise chaque mois ? Découvrez Notre Caisse !",
        "Fini le cahier de cotisations : tout le monde voit le montant en caisse, en temps réel.",
        "Qui a cotisé ce mois ? Vous le savez en un coup d'œil.",
        "Chacun déclare son dépôt Airtel Money ou Moov Money, avec la capture d'écran.",
        "La trésorière vérifie, puis valide en un seul clic.",
        "À jour ou en retard ? Chaque membre a son historique, mois par mois.",
        "Et l'application envoie des rappels avant le dix du mois.",
        f"Notre Caisse, par Orly Digital. Pour votre application sur mesure, écrivez-nous sur WhatsApp au {TEL}.",
    ],
    'stock': [
        "Vous avez une boutique de cosmétiques ? Voici Beauté Stock !",
        "Vos ventes et votre bénéfice du jour, en direct sur votre téléphone.",
        "Une vente s'enregistre en trois appuis : espèces, Airtel ou Moov Money.",
        "L'application vous prévient quand un produit va manquer.",
        "Le stock se met à jour tout seul, à chaque vente.",
        "Vos vendeuses enregistrent les ventes, et vous gardez le contrôle.",
        "Bénéfice du mois, valeur du stock : vous savez enfin où va votre argent.",
        f"Beauté Stock, par Orly Digital. Pour votre application, écrivez-nous sur WhatsApp au {TEL}.",
    ],
    'tontine': [
        "Votre tontine se gère encore dans un cahier ? Essayez Tontine Facile !",
        "Votre prochain tour, vos cotisations : tout est clair.",
        "Toutes vos tontines, au même endroit.",
        "Qui a payé ? Qui reçoit ce mois-ci ? Tout le monde le voit.",
        "Le calendrier des tours est connu de tous. Fini les disputes !",
        "La présidente vérifie la capture, et valide en un clic.",
        "En retard ? La pénalité se calcule automatiquement.",
        f"Tontine Facile, par Orly Digital. Votre application sur mesure : WhatsApp, {TEL}.",
    ],
}

k = Kokoro('/tmp/claude-0/tts/kokoro-v1.0.onnx', '/tmp/claude-0/tts/voices-v1.0.bin')
meta = {}
for name, lines in SCRIPTS.items():
    if len(sys.argv) > 2 and sys.argv[2] != name:
        continue
    os.makedirs(f'{OUT}/{name}', exist_ok=True)
    meta[name] = []
    for i, text in enumerate(lines):
        s, sr = k.create(text, voice='ff_siwis', speed=1.05, lang='fr-fr')
        # retire les silences en début / fin
        a = np.abs(s) > 0.01
        if a.any():
            s = s[max(0, a.argmax() - 1200): len(s) - a[::-1].argmax() + 2400]
        path = f'{OUT}/{name}/{i:02d}.wav'
        sf.write(path, s, sr)
        meta[name].append({'file': path, 'dur': round(len(s) / sr, 3), 'text': text})
        print(name, i, round(len(s) / sr, 2), 's')
json.dump(meta, open(f'{OUT}/voix.json', 'w'), ensure_ascii=False, indent=1)
