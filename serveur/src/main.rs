//! Serveur local de Plume : sert les fichiers du dépôt (index.html, dist/…)
//! et l'API de coédition en temps réel /api/plume/collab.
//!
//! Utilisation : plume-serveur [port] [dossier] [--reseau]
//!   port       8080 par défaut
//!   dossier    racine de Plume ; par défaut le dossier courant s'il contient
//!              Plume, sinon le dépôt où le serveur a été compilé
//!   --reseau   accepte aussi les autres appareils du réseau (sinon ce PC seul)

mod collab;

use serde_json::Value;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::{env, fs, process, thread};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

type Reponse = Response<Cursor<Vec<u8>>>;

const API: &str = "/api/plume/collab";
const CORPS_MAX: usize = 6 * 1024 * 1024;

fn main() {
    let mut port: u16 = 8080;
    let mut dossier = None;
    let mut reseau = false;
    let mut rang = 0;
    for arg in env::args().skip(1) {
        if arg == "--reseau" {
            reseau = true;
            continue;
        }
        match rang {
            0 => port = arg.parse().unwrap_or_else(|_| quitter(&format!("port invalide : {arg}"))),
            1 => dossier = Some(PathBuf::from(arg)),
            _ => quitter("trop d'arguments (plume-serveur [port] [dossier] [--reseau])"),
        }
        rang += 1;
    }
    let dossier = dossier.unwrap_or_else(dossier_par_defaut);
    let racine = fs::canonicalize(&dossier)
        .unwrap_or_else(|e| quitter(&format!("dossier introuvable {} : {e}", dossier.display())));
    let hote = if reseau { "0.0.0.0" } else { "127.0.0.1" };
    let serveur = Server::http((hote, port))
        .unwrap_or_else(|e| quitter(&format!("impossible d'écouter sur le port {port} : {e}")));
    println!("Plume : http://localhost:{port}/");

    let racine = Arc::new(racine);
    let salles = Arc::new(Mutex::new(collab::Salles::default()));
    for requete in serveur.incoming_requests() {
        let (racine, salles) = (Arc::clone(&racine), Arc::clone(&salles));
        thread::spawn(move || repondre(requete, &racine, &salles));
    }
}

fn dossier_par_defaut() -> PathBuf {
    let ici = env::current_dir().unwrap_or_default();
    if ici.join("texte.html").is_file() {
        ici
    } else {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
    }
}

fn quitter(message: &str) -> ! {
    eprintln!("plume-serveur : {message}");
    process::exit(1)
}

fn repondre(mut requete: Request, racine: &Path, salles: &Mutex<collab::Salles>) {
    let chemin = requete.url().split('?').next().unwrap_or_default().to_owned();
    let reponse = if chemin == API { api(&mut requete, salles) } else { fichier(&chemin, racine) };
    let _ = requete.respond(reponse);
}

fn api(requete: &mut Request, salles: &Mutex<collab::Salles>) -> Reponse {
    if *requete.method() != Method::Post {
        return json(405, &collab::refus("methode"));
    }
    let mut corps = Vec::new();
    if requete.as_reader().take(CORPS_MAX as u64 + 1).read_to_end(&mut corps).is_err() {
        return json(400, &collab::refus("json"));
    }
    if corps.len() > CORPS_MAX {
        return json(413, &collab::refus("toobig"));
    }
    match serde_json::from_str::<Value>(&String::from_utf8_lossy(&corps)) {
        Ok(q) if !q.is_null() => {
            let reponse = salles.lock().unwrap_or_else(|e| e.into_inner()).traiter(&q);
            json(200, &reponse)
        }
        _ => json(400, &collab::refus("json")),
    }
}

fn fichier(brut: &str, racine: &Path) -> Reponse {
    let Some(mut chemin) = decoder(brut) else { return texte(400, "Adresse invalide") };
    if chemin.ends_with('/') {
        chemin.push_str("index.html");
    }
    let mut cible = racine.to_path_buf();
    for morceau in chemin.split(['/', '\\']).filter(|m| !m.is_empty() && *m != ".") {
        // Remontée (..), lecteur (C:), flux NTFS : interdits. Fichiers cachés (.git…) : invisibles.
        if morceau == ".." || morceau.contains([':', '\0']) {
            return texte(403, "Interdit");
        }
        if morceau.starts_with('.') {
            return texte(404, "Introuvable");
        }
        cible.push(morceau);
    }
    let Ok(vrai) = fs::canonicalize(&cible) else { return texte(404, "Introuvable") };
    if !vrai.starts_with(racine) {
        return texte(403, "Interdit");
    }
    if !vrai.is_file() {
        return texte(404, "Introuvable");
    }
    match fs::read(&vrai) {
        Ok(contenu) => Response::from_data(contenu)
            .with_header(entete("Content-Type", type_mime(&vrai)))
            .with_header(entete("Cache-Control", "no-cache")),
        Err(_) => texte(404, "Introuvable"),
    }
}

/// Décode les %XX d'une adresse comme decodeURIComponent ; None si elle est mal formée.
fn decoder(brut: &str) -> Option<String> {
    let octets = brut.as_bytes();
    let mut sortie = Vec::with_capacity(octets.len());
    let mut i = 0;
    while i < octets.len() {
        if octets[i] == b'%' {
            let hex = octets.get(i + 1..i + 3).filter(|h| h.iter().all(u8::is_ascii_hexdigit))?;
            sortie.push(u8::from_str_radix(std::str::from_utf8(hex).ok()?, 16).ok()?);
            i += 3;
        } else {
            sortie.push(octets[i]);
            i += 1;
        }
    }
    String::from_utf8(sortie).ok()
}

fn type_mime(chemin: &Path) -> &'static str {
    let extension = chemin.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase);
    match extension.as_deref() {
        Some("html") => "text/html; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json" | "map") => "application/json",
        Some("webmanifest") => "application/manifest+json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("wasm") => "application/wasm",
        Some("txt" | "md") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn texte(code: u16, message: &str) -> Reponse {
    Response::from_data(message.as_bytes().to_vec())
        .with_status_code(StatusCode(code))
        .with_header(entete("Content-Type", "text/plain; charset=utf-8"))
}

fn json(code: u16, valeur: &Value) -> Reponse {
    Response::from_data(serde_json::to_vec(valeur).unwrap_or_default())
        .with_status_code(StatusCode(code))
        .with_header(entete("Content-Type", "application/json; charset=utf-8"))
        .with_header(entete("Cache-Control", "no-store"))
}

fn entete(nom: &str, valeur: &str) -> Header {
    Header::from_bytes(nom.as_bytes(), valeur.as_bytes()).expect("en-tête HTTP valide")
}
