"""Fabrique site/index.html à partir de site/modele.html et des fichiers à télécharger.

Usage : python site/generer.py <dossier des fichiers> <version AAAA.MM.JJ>
Remplace {{version}}, {{date}}, {{taille:NOM}} et {{fichier:NOM|titre|détail}}
(taille et empreinte SHA-256 de chaque fichier ; « bientôt disponible » s'il manque).
"""
import hashlib
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
dossier, version = sys.argv[1], sys.argv[2]
MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
        'septembre', 'octobre', 'novembre', 'décembre']
a, m, j = (int(x) for x in version.split('.')[:3])
date = f'{j}{"er" if j == 1 else ""} {MOIS[m - 1]} {a}'


def taille(nom):
    chemin = os.path.join(dossier, nom)
    if not os.path.isfile(chemin):
        return ''
    o = os.path.getsize(chemin)
    if o < 1024 * 1024:
        return f'{round(o / 1024)} Ko'
    return f'{o / 1024 / 1024:.1f} Mo'.replace('.', ',')


def empreinte(nom):
    h = hashlib.sha256()
    with open(os.path.join(dossier, nom), 'rb') as f:
        for bloc in iter(lambda: f.read(1 << 20), b''):
            h.update(bloc)
    return h.hexdigest()


def fichier(m):
    nom, titre, detail = m.group(1).split('|')
    if not os.path.isfile(os.path.join(dossier, nom)):
        print('absent :', nom)
        return (f'<div class="fichier"><div><b>{titre}</b><div class="detail">{detail}</div></div>'
                f'<span class="bouton creux" aria-disabled="true">Bientôt disponible</span></div>')
    return (f'<div class="fichier"><div><b>{titre}</b><div class="detail">{detail} · {nom} · {taille(nom)}</div></div>'
            f'<a class="bouton plein" href="/telecharger/{nom}" download><svg class="i"><use href="#i-dl"/></svg>Télécharger</a>'
            f'<div class="empreinte">SHA-256 : {empreinte(nom)}</div></div>')


LISTE = []


def ligne(m):
    """Ligne de tableau : {{ligne:NOM|système (pour le surlignage)|système affiché|architecture}}"""
    nom, os_, systeme, arch = m.group(1).split('|')
    present = os.path.isfile(os.path.join(dossier, nom))
    if present:
        LISTE.append(nom)
        action = (f'<a class="bouton plein" href="/telecharger/{nom}" download>'
                  f'<svg class="i"><use href="#i-dl"/></svg>Télécharger</a>')
    else:
        print('absent :', nom)
        action = '<span class="bouton creux" aria-disabled="true">Bientôt</span>'
    return (f'<tr data-os="{os_}"><td class="systeme">{systeme}<span class="ici-badge">Ton ordinateur</span></td>'
            f'<td>{arch}</td><td class="fichier-nom"><code>{nom}</code></td>'
            f'<td class="taille">{taille(nom)}</td><td class="action">{action}</td></tr>')


s = open(os.path.join(ICI, 'modele.html'), encoding='utf-8').read()
s = s.replace('{{version}}', version).replace('{{date}}', date)
s = re.sub(r'\{\{taille:([^}]+)\}\}', lambda m: taille(m.group(1)), s)
s = re.sub(r'\{\{fichier:([^}]+)\}\}', fichier, s)
s = re.sub(r'\{\{ligne:([^}]+)\}\}', ligne, s)
s = s.replace('{{empreintes}}', '<div class="empreintes">' + ''.join(
    f'<div><b>{n}</b>  {empreinte(n)}</div>' for n in LISTE) + '</div>')
assert '{{' not in s, 'balise non remplacée'
open(os.path.join(ICI, 'index.html'), 'w', encoding='utf-8', newline='\n').write(s)
print('site/index.html :', len(s), 'caractères')
