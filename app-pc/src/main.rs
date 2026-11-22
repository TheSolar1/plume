#![windows_subsystem = "windows"]
//! Plume pour Windows : une application de bureau. Une fenêtre (moteur WebView2
//! de Windows) affiche Plume, dont les pages sont intégrées au programme : pas de
//! navigateur ni de serveur à lancer, et tout marche hors ligne.
//! - les documents restent enregistrés dans l'application (dossier %LOCALAPPDATA%\Plume) ;
//! - les fichiers enregistrés ou exportés (.docx, .pdf…) vont dans Documents\Plume ;
//! - les liens vers Internet s'ouvrent dans le navigateur habituel ;
//! - Clouds : un cloud (VEX, Nextcloud…) s'ouvre dans sa propre fenêtre, connexion gardée ;
//! - serveur MCP facultatif (Réglages) pour les assistants IA : voir mcp.rs.

mod mcp;

use plume_serveur::collab::{refus, Salles};
use plume_serveur::type_mime;
use serde_json::Value;
use std::borrow::Cow;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::{env, fs, thread};
use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tao::platform::windows::{IconExtWindows, WindowBuilderExtWindows};
use tao::window::{Icon, Window, WindowBuilder, WindowId};
use wry::http::{header::CONTENT_TYPE, Method, Request, Response, StatusCode};
use wry::{NewWindowResponse, WebContext, WebView, WebViewBuilder, WebViewBuilderExtWindows};

include!(concat!(env!("OUT_DIR"), "/fichiers.rs"));

/// Adresse interne fixe : les documents enregistrés dans l'application y restent attachés.
const ADRESSE: &str = "https://plume.localhost/";
/// Page de départ : accueil et onglets de documents, comme OnlyOffice Desktop.
const DEPART: &str = "https://plume.localhost/bureau.html";
/// Avant de fermer : enregistre les documents de tous les onglets.
const ENREGISTRER: &str = "try { if (window.plumeBureau) window.plumeBureau.toutEnregistrer(); else for (const a of [window.plume, window.plumePres, window.plumeCalc]) if (a && a.dirty && a.saveLocal) a.saveLocal(); } catch (e) {}";

enum Evenement {
    Titre(String),
    Quitter,
    /// Ouvrir un cloud dans sa fenêtre : (nom, adresse)
    Cloud(String, String),
    /// Réglage du serveur MCP : (activé, port)
    Mcp(bool, u16),
    /// Outil demandé par l'assistant IA, à exécuter dans la page : (numéro, nom, arguments JSON)
    McpAppel(u64, String, String),
}

fn main() {
    let boucle = EventLoopBuilder::<Evenement>::with_user_event().build();
    let proxy = boucle.create_proxy();
    let fenetre = WindowBuilder::new()
        .with_title("Plume")
        .with_inner_size(LogicalSize::new(1360.0, 860.0))
        .with_min_inner_size(LogicalSize::new(640.0, 420.0))
        .with_maximized(true)
        .with_window_icon(Icon::from_resource(1, None).ok())
        .with_taskbar_icon(Icon::from_resource(1, None).ok())
        .build(&boucle)
        .expect("création de la fenêtre");

    let donnees = env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(env::temp_dir).join("Plume");
    let mut contexte = WebContext::new(Some(donnees.join("WebView2")));
    let salles = Arc::new(Mutex::new(Salles::default()));
    let titre = proxy.clone();
    let attentes: mcp::Attentes = Arc::new(Mutex::new(HashMap::new()));
    let (p_ipc, a_ipc) = (proxy.clone(), attentes.clone());
    let vue = WebViewBuilder::new_with_web_context(&mut contexte)
        .with_https_scheme(true)
        .with_custom_protocol("plume".into(), move |_id, requete| repondre(&salles, requete))
        .with_url(DEPART)
        .with_ipc_handler(move |m| message_page(m.body(), &p_ipc, &a_ipc))
        .with_document_title_changed_handler(move |t| { let _ = titre.send_event(Evenement::Titre(t)); })
        .with_navigation_handler(|url| {
            let interne = url.starts_with(ADRESSE) || url.starts_with("about:") || url.starts_with("data:") || url.starts_with("blob:");
            if !interne { ouvrir_dehors(&url); }
            interne
        })
        .with_new_window_req_handler(|url, _| {
            if !url.is_empty() && !url.starts_with("about:") { ouvrir_dehors(&url); }
            NewWindowResponse::Deny
        })
        .with_download_started_handler(telechargement)
        .build(&fenetre)
        .expect("WebView2 (moteur d'affichage de Windows)");

    let principale = fenetre.id();
    let mut clouds: HashMap<WindowId, (Window, WebView)> = HashMap::new();
    let mut serveur_mcp: Option<mcp::ServeurMcp> = None;
    boucle.run(move |evenement, cible, controle| {
        *controle = ControlFlow::Wait;
        match evenement {
            Event::UserEvent(Evenement::Titre(t)) => fenetre.set_title(if t.trim().is_empty() { "Plume" } else { &t }),
            Event::UserEvent(Evenement::Cloud(nom, url)) => {
                if let Some((f, v)) = fenetre_cloud(cible, &mut contexte, &nom, &url) {
                    clouds.insert(f.id(), (f, v));
                }
            }
            Event::UserEvent(Evenement::McpAppel(n, nom, args)) => {
                let nom = serde_json::to_string(&nom).unwrap_or_else(|_| "\"\"".into());
                let _ = vue.evaluate_script(&format!(
                    "window.plumeBureau ? window.plumeBureau.mcp({n}, {nom}, {args}) : window.ipc.postMessage(JSON.stringify({{type:'mcp-reponse', id:{n}, erreur:'Plume n\\'est pas prêt.'}}))"
                ));
            }
            Event::UserEvent(Evenement::Mcp(actif, port)) => {
                let deja = serveur_mcp.as_ref().map(|s| s.port);
                if !actif || deja != Some(port) {
                    if let Some(s) = serveur_mcp.take() { s.arreter(); }
                }
                let etat = if !actif {
                    "Arrêté.".to_string()
                } else if serveur_mcp.is_some() {
                    format!("En marche : http://127.0.0.1:{port}/mcp")
                } else {
                    let p = proxy.clone();
                    let transmettre: mcp::Transmettre = Arc::new(move |n, nom, args| { let _ = p.send_event(Evenement::McpAppel(n, nom, args)); });
                    match mcp::ServeurMcp::demarrer(port, transmettre, attentes.clone()) {
                        Ok(s) => { serveur_mcp = Some(s); format!("En marche : http://127.0.0.1:{port}/mcp") }
                        Err(e) => format!("Impossible de démarrer sur le port {port} ({e}). Essayez un autre port."),
                    }
                };
                let etat = serde_json::to_string(&etat).unwrap_or_default();
                let _ = vue.evaluate_script(&format!("window.plumeBureau && window.plumeBureau.etatMcp({etat})"));
            }
            Event::WindowEvent { window_id, event: WindowEvent::CloseRequested, .. } if window_id != principale => {
                clouds.remove(&window_id);
            }
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                // On laisse le temps d'enregistrer le document, puis on ferme.
                let _ = vue.evaluate_script(ENREGISTRER);
                let p = proxy.clone();
                thread::spawn(move || { thread::sleep(Duration::from_millis(600)); let _ = p.send_event(Evenement::Quitter); });
            }
            Event::UserEvent(Evenement::Quitter) => *controle = ControlFlow::Exit,
            _ => {}
        }
    });
}

/// Messages de la page d'accueil (window.ipc.postMessage).
fn message_page(texte: &str, proxy: &tao::event_loop::EventLoopProxy<Evenement>, attentes: &mcp::Attentes) {
    let Ok(m) = serde_json::from_str::<Value>(texte) else { return };
    match m.get("type").and_then(Value::as_str) {
        Some("cloud") => {
            let url = m.get("url").and_then(Value::as_str).unwrap_or("");
            if url.starts_with("https://") || url.starts_with("http://") {
                let nom = m.get("nom").and_then(Value::as_str).unwrap_or("Cloud");
                let _ = proxy.send_event(Evenement::Cloud(nom.to_string(), url.to_string()));
            }
        }
        Some("mcp") => {
            let actif = m.get("actif").and_then(Value::as_bool).unwrap_or(false);
            let port = m.get("port").and_then(Value::as_u64).filter(|p| (1024..=65535).contains(p)).unwrap_or(3939) as u16;
            let _ = proxy.send_event(Evenement::Mcp(actif, port));
        }
        Some("mcp-reponse") => {
            if let Some(n) = m.get("id").and_then(Value::as_u64) {
                if let Some(tx) = attentes.lock().unwrap_or_else(|e| e.into_inner()).remove(&n) {
                    let _ = tx.send(m);
                }
            }
        }
        _ => {}
    }
}

/// Fenêtre d'un cloud : le site s'y affiche tel quel (connexion gardée dans le
/// dossier de l'application) ; fichiers téléchargés dans Documents\Plume.
fn fenetre_cloud(cible: &tao::event_loop::EventLoopWindowTarget<Evenement>, contexte: &mut WebContext, nom: &str, url: &str) -> Option<(Window, WebView)> {
    let f = WindowBuilder::new()
        .with_title(format!("{nom} – Plume"))
        .with_inner_size(LogicalSize::new(1280.0, 840.0))
        .with_min_inner_size(LogicalSize::new(480.0, 360.0))
        .with_window_icon(Icon::from_resource(1, None).ok())
        .with_taskbar_icon(Icon::from_resource(1, None).ok())
        .build(cible)
        .ok()?;
    let v = WebViewBuilder::new_with_web_context(contexte)
        .with_url(url)
        .with_new_window_req_handler(|url, _| {
            if !url.is_empty() && !url.starts_with("about:") { ouvrir_dehors(&url); }
            NewWindowResponse::Deny
        })
        .with_download_started_handler(telechargement)
        .build(&f)
        .ok()?;
    Some((f, v))
}

/// Fichiers enregistrés ou téléchargés : dans Documents\Plume, sans écraser.
fn telechargement(_url: String, chemin: &mut PathBuf) -> bool {
    let dossier = dossier_documents().join("Plume");
    let _ = fs::create_dir_all(&dossier);
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "document".into());
    *chemin = nom_libre(&dossier, &nom);
    true
}

/// Pages intégrées et coédition (même API que le serveur, sur ce PC).
fn repondre(salles: &Mutex<Salles>, requete: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let chemin = requete.uri().path();
    if chemin == "/api/plume/collab" {
        let reponse = if requete.method() != Method::POST {
            refus("methode")
        } else {
            match serde_json::from_slice::<Value>(requete.body()) {
                Ok(q) if !q.is_null() => salles.lock().unwrap_or_else(|e| e.into_inner()).traiter(&q),
                _ => refus("json"),
            }
        };
        return Response::builder()
            .header(CONTENT_TYPE, "application/json; charset=utf-8")
            .header("Cache-Control", "no-store")
            .body(Cow::Owned(serde_json::to_vec(&reponse).unwrap_or_default()))
            .expect("réponse");
    }
    let nom = match chemin.trim_start_matches('/') { "" => "index.html", n => n };
    match FICHIERS.iter().find(|(f, _)| *f == nom) {
        Some((f, contenu)) => Response::builder()
            .header(CONTENT_TYPE, type_mime(f.rsplit('.').next().unwrap_or("")))
            .body(Cow::Borrowed(*contenu))
            .expect("réponse"),
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(Cow::Borrowed(&b"Introuvable"[..]))
            .expect("réponse"),
    }
}

fn dossier_documents() -> PathBuf {
    let profil = env::var_os("USERPROFILE").map(PathBuf::from).unwrap_or_else(env::temp_dir);
    let documents = profil.join("Documents");
    if documents.is_dir() { documents } else { profil }
}

/// Ne remplace jamais un fichier existant : « Rapport (2).docx », « Rapport (3).docx »…
fn nom_libre(dossier: &Path, nom: &str) -> PathBuf {
    let chemin = dossier.join(nom);
    if !chemin.exists() {
        return chemin;
    }
    let (base, ext) = match nom.rfind('.') {
        Some(i) if i > 0 => (&nom[..i], &nom[i..]),
        _ => (nom, ""),
    };
    (2..).map(|n| dossier.join(format!("{base} ({n}){ext}"))).find(|c| !c.exists()).expect("nom libre")
}

/// Liens vers Internet, adresses e-mail : navigateur ou messagerie habituels.
fn ouvrir_dehors(url: &str) {
    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("mailto:") {
        let _ = Command::new("explorer").arg(url).spawn();
    }
}
