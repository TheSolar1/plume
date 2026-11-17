// ══════════════════════════════════════════════════════════════════
// plume-serveur : le serveur local de Plume.
//
//   cargo run --release --manifest-path serveur/Cargo.toml [port] [dossier]
//
// Sert les pages de Plume (index.html, texte.html… et dist/) depuis le
// dossier donne (par defaut : le dossier courant) et fournit le point de
// rendez-vous de la coedition en temps reel : POST /api/plume/collab.
// Port par defaut : 8080.
// ══════════════════════════════════════════════════════════════════
mod collab;

use std::collections::HashMap;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use tiny_http::{Header, Method, Request, Response, Server};

type Salles = Arc<Mutex<HashMap<String, collab::Salle>>>;

fn entete(nom: &str, valeur: &str) -> Header {
    Header::from_bytes(nom.as_bytes(), valeur.as_bytes()).expect("en-tete valide")
}

fn type_mime(chemin: &Path) -> &'static str {
    match chemin.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        "webmanifest" => "application/manifest+json",
        "txt" | "md" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// Decode les %XX d'une URL (UTF-8) ; renvoie None si le codage est invalide.
fn decoder_url(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let h = s.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(h, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Chemin du fichier demande, a l'interieur de `racine` uniquement :
/// tout « .. », chemin absolu ou fichier cache (.git…) est refuse.
fn chemin_sur(racine: &Path, url: &str) -> Option<PathBuf> {
    let brut = url.split(['?', '#']).next().unwrap_or("/");
    let mut chemin = decoder_url(brut)?;
    if chemin.contains('\0') || chemin.contains('\\') {
        return None;
    }
    if chemin.ends_with('/') {
        chemin.push_str("index.html");
    }
    let mut complet = racine.to_path_buf();
    for c in Path::new(chemin.trim_start_matches('/')).components() {
        match c {
            Component::Normal(p) => {
                if p.to_str().map(|t| t.starts_with('.')).unwrap_or(true) {
                    return None;
                }
                complet.push(p);
            }
            Component::CurDir => {}
            _ => return None,
        }
    }
    Some(complet)
}

fn repondre_json(requete: Request, v: &serde_json::Value, statut: u16) {
    let rep = Response::from_data(v.to_string().into_bytes())
        .with_status_code(statut)
        .with_header(entete("Content-Type", "application/json; charset=utf-8"))
        .with_header(entete("Cache-Control", "no-store"));
    let _ = requete.respond(rep);
}

fn traiter_collab(mut requete: Request, salles: &Salles) {
    if *requete.method() != Method::Post {
        return repondre_json(requete, &collab::refus("methode"), 405);
    }
    let annonce = requete.body_length().unwrap_or(0) as u64;
    let mut corps = Vec::new();
    if annonce > collab::CORPS_MAX
        || requete.as_reader().take(collab::CORPS_MAX + 1).read_to_end(&mut corps).is_err()
        || corps.len() as u64 > collab::CORPS_MAX
    {
        return repondre_json(requete, &collab::refus("toobig"), 413);
    }
    let Ok(req) = serde_json::from_slice::<serde_json::Value>(&corps) else {
        return repondre_json(requete, &collab::refus("json"), 400);
    };
    let action = req.get("action").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let rep = {
        let mut verrou = salles.lock().unwrap_or_else(|e| e.into_inner());
        collab::traiter(&mut verrou, &action, &req, None)
    };
    repondre_json(requete, &rep, 200);
}

fn servir_fichier(requete: Request, racine: &Path) {
    if *requete.method() != Method::Get && *requete.method() != Method::Head {
        let _ = requete.respond(Response::from_string("Méthode non autorisée").with_status_code(405));
        return;
    }
    let Some(chemin) = chemin_sur(racine, requete.url()) else {
        let _ = requete.respond(Response::from_string("Interdit").with_status_code(403));
        return;
    };
    // ETag (taille + date) : un fichier inchange repond 304 sans corps.
    let etag = std::fs::metadata(&chemin).ok().filter(|m| m.is_file()).map(|m| {
        let date = m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
        format!("\"{:x}-{:x}\"", m.len(), date)
    });
    let Some(etag) = etag else {
        let _ = requete.respond(Response::from_string("Introuvable").with_status_code(404));
        return;
    };
    let deja = requete.headers().iter().find(|h| h.field.equiv("If-None-Match")).map(|h| h.value.as_str() == etag).unwrap_or(false);
    if deja {
        let _ = requete.respond(Response::empty(304).with_header(entete("ETag", &etag)).with_header(entete("Cache-Control", "no-cache")));
        return;
    }
    match std::fs::read(&chemin) {
        Ok(donnees) => {
            let rep = Response::from_data(donnees)
                .with_header(entete("Content-Type", type_mime(&chemin)))
                .with_header(entete("ETag", &etag))
                .with_header(entete("Cache-Control", "no-cache"))
                .with_header(entete("X-Content-Type-Options", "nosniff"));
            let _ = requete.respond(rep);
        }
        Err(_) => {
            let _ = requete.respond(Response::from_string("Introuvable").with_status_code(404));
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let port: u16 = args.first().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let racine = PathBuf::from(args.get(1).map(|s| s.as_str()).unwrap_or("."));
    let racine = match racine.canonicalize() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Dossier introuvable ({}) : {}", racine.display(), e);
            std::process::exit(1);
        }
    };
    if !racine.join("texte.html").is_file() {
        eprintln!("Attention : {} ne contient pas texte.html — lancez le serveur depuis le dossier de Plume, ou indiquez-le en 2e argument.", racine.display());
    }
    let serveur = match Server::http(("0.0.0.0", port)) {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("Impossible d'ouvrir le port {} : {}", port, e);
            std::process::exit(1);
        }
    };
    println!("Plume : http://localhost:{}/  (dossier : {})", port, racine.display());
    let salles: Salles = Arc::new(Mutex::new(HashMap::new()));
    let racine = Arc::new(racine);
    let mut fils = Vec::new();
    for _ in 0..8 {
        let (serveur, salles, racine) = (serveur.clone(), salles.clone(), racine.clone());
        fils.push(std::thread::spawn(move || loop {
            let Ok(requete) = serveur.recv() else { break };
            if requete.url().split('?').next() == Some("/api/plume/collab") {
                traiter_collab(requete, &salles);
            } else {
                servir_fichier(requete, &racine);
            }
        }));
    }
    for f in fils {
        let _ = f.join();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chemins_surs() {
        let r = Path::new("/srv/plume");
        assert_eq!(chemin_sur(r, "/"), Some(PathBuf::from("/srv/plume/index.html")));
        assert_eq!(chemin_sur(r, "/texte.html?collab=abc"), Some(PathBuf::from("/srv/plume/texte.html")));
        assert_eq!(chemin_sur(r, "/dist/texte.js"), Some(PathBuf::from("/srv/plume/dist/texte.js")));
        assert_eq!(chemin_sur(r, "/a%20b.html"), Some(PathBuf::from("/srv/plume/a b.html")));
        // sorties du dossier, fichiers caches, codages pieges
        assert_eq!(chemin_sur(r, "/../etc/passwd"), None);
        assert_eq!(chemin_sur(r, "/dist/../../x"), None);
        assert_eq!(chemin_sur(r, "/%2e%2e/x"), None);
        assert_eq!(chemin_sur(r, "/.git/config"), None);
        assert_eq!(chemin_sur(r, "/a%00.html"), None);
        assert_eq!(chemin_sur(r, "/..%5cx"), None);
        assert_eq!(chemin_sur(r, "/%zz"), None);
    }

    #[test]
    fn types_mime() {
        assert_eq!(type_mime(Path::new("a/texte.html")), "text/html; charset=utf-8");
        assert_eq!(type_mime(Path::new("dist/texte.JS")), "text/javascript; charset=utf-8");
        assert_eq!(type_mime(Path::new("x.inconnu")), "application/octet-stream");
    }
}
