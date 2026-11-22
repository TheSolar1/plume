//! Serveur MCP de Plume (Model Context Protocol, transport « Streamable HTTP ») :
//! permet à un assistant IA (Claude…) d'utiliser les documents de Plume.
//! - désactivé par défaut, activé dans Réglages ; n'écoute que sur 127.0.0.1 ;
//! - refuse les requêtes venant d'une page web (en-têtes Origin et Host contrôlés) ;
//! - chaque outil est exécuté par la page d'accueil de Plume (là où sont les
//!   documents) : la requête lui est transmise, puis on attend sa réponse.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Read;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tiny_http::{Header, Response, Server};

/// Réponses attendues de la page, par numéro d'appel.
pub type Attentes = Arc<Mutex<HashMap<u64, Sender<Value>>>>;
/// Transmet un appel d'outil à la page : (numéro, nom de l'outil, arguments JSON).
pub type Transmettre = Arc<dyn Fn(u64, String, String) + Send + Sync>;

const VERSION_PROTOCOLE: &str = "2025-06-18";
const TAILLE_MAX: u64 = 20 * 1024 * 1024;

pub struct ServeurMcp {
    serveur: Arc<Server>,
    pub port: u16,
}

impl ServeurMcp {
    pub fn demarrer(port: u16, transmettre: Transmettre, attentes: Attentes) -> Result<Self, String> {
        let serveur = Arc::new(Server::http(("127.0.0.1", port)).map_err(|e| e.to_string())?);
        let s = serveur.clone();
        let compteur = Arc::new(AtomicU64::new(1));
        thread::spawn(move || {
            for requete in s.incoming_requests() {
                let (t, a, c) = (transmettre.clone(), attentes.clone(), compteur.clone());
                thread::spawn(move || traiter(requete, port, &t, &a, &c));
            }
        });
        Ok(ServeurMcp { serveur, port })
    }
    pub fn arreter(&self) {
        self.serveur.unblock();
    }
}

fn entete<'a>(r: &'a tiny_http::Request, nom: &'static str) -> Option<&'a str> {
    r.headers().iter().find(|h| h.field.equiv(nom)).map(|h| h.value.as_str())
}

fn local(adresse: &str) -> bool {
    let a = adresse.trim_start_matches("http://").trim_start_matches("https://");
    let hote = a.split(['/', ':']).next().unwrap_or("");
    hote == "127.0.0.1" || hote == "localhost" || hote == "[::1]"
}

fn json_reponse(code: u16, corps: &Value) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_data(serde_json::to_vec(corps).unwrap_or_default())
        .with_status_code(code)
        .with_header(Header::from_bytes("Content-Type", "application/json; charset=utf-8").expect("en-tête"))
}

fn traiter(mut requete: tiny_http::Request, port: u16, transmettre: &Transmettre, attentes: &Attentes, compteur: &AtomicU64) {
    // Protection contre les pages web (DNS rebinding, requêtes d'un autre site)
    let origine_ok = entete(&requete, "Origin").map_or(true, local);
    let hote_ok = entete(&requete, "Host").map_or(false, local);
    if !origine_ok || !hote_ok {
        let _ = requete.respond(Response::from_string("Interdit").with_status_code(403));
        return;
    }
    let chemin = requete.url().split('?').next().unwrap_or("").to_string();
    if chemin != "/mcp" && chemin != "/" {
        let _ = requete.respond(Response::from_string(format!("Serveur MCP de Plume : http://127.0.0.1:{port}/mcp")).with_status_code(404));
        return;
    }
    if requete.method() != &tiny_http::Method::Post {
        let _ = requete.respond(Response::from_string("Utilisez POST").with_status_code(405).with_header(Header::from_bytes("Allow", "POST").expect("en-tête")));
        return;
    }
    let mut corps = String::new();
    if requete.as_reader().take(TAILLE_MAX).read_to_string(&mut corps).is_err() {
        let _ = requete.respond(json_reponse(400, &erreur(Value::Null, -32700, "Corps illisible")));
        return;
    }
    let message: Value = match serde_json::from_str(&corps) {
        Ok(v) => v,
        Err(_) => {
            let _ = requete.respond(json_reponse(400, &erreur(Value::Null, -32700, "JSON invalide")));
            return;
        }
    };
    let reponse = match message {
        Value::Array(lot) => {
            let r: Vec<Value> = lot.iter().filter_map(|m| repondre(m, transmettre, attentes, compteur)).collect();
            if r.is_empty() { None } else { Some(Value::Array(r)) }
        }
        m => repondre(&m, transmettre, attentes, compteur),
    };
    let _ = match reponse {
        Some(r) => requete.respond(json_reponse(200, &r)),
        None => requete.respond(Response::empty(202)),
    };
}

fn erreur(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn repondre(m: &Value, transmettre: &Transmettre, attentes: &Attentes, compteur: &AtomicU64) -> Option<Value> {
    let id = m.get("id").cloned()?; // sans id : notification, pas de réponse
    let methode = m.get("method").and_then(Value::as_str).unwrap_or("");
    let params = m.get("params").cloned().unwrap_or(Value::Null);
    let resultat = match methode {
        "initialize" => json!({
            "protocolVersion": params.get("protocolVersion").and_then(Value::as_str).unwrap_or(VERSION_PROTOCOLE),
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": "plume", "title": "Plume", "version": env!("CARGO_PKG_VERSION") },
            "instructions": "Plume est une suite bureautique (Texte, Tableur, Présentation). Utilisez lister_documents pour obtenir les identifiants, puis les autres outils. Le texte des documents Texte s'écrit en Markdown ; les tableaux du Tableur en CSV/TSV ; les présentations sous forme de plan : une diapositive par bloc, blocs séparés par une ligne vide (ou commençant par # ) ; dans chaque bloc, la 1re ligne est le titre et les suivantes des puces (- texte ; 2 espaces de retrait = sous-niveau).",
        }),
        "ping" => json!({}),
        "tools/list" => json!({ "tools": outils() }),
        "tools/call" => {
            let nom = params.get("name").and_then(Value::as_str).unwrap_or("").to_string();
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            appeler(nom, args, transmettre, attentes, compteur)
        }
        _ => return Some(erreur(id, -32601, &format!("Méthode inconnue : {methode}"))),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": resultat }))
}

fn appeler(nom: String, args: Value, transmettre: &Transmettre, attentes: &Attentes, compteur: &AtomicU64) -> Value {
    let n = compteur.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = channel();
    attentes.lock().unwrap_or_else(|e| e.into_inner()).insert(n, tx);
    transmettre(n, nom, args.to_string());
    let reponse = rx.recv_timeout(Duration::from_secs(90));
    attentes.lock().unwrap_or_else(|e| e.into_inner()).remove(&n);
    let (texte, echec) = match reponse {
        Ok(v) => match v.get("erreur").and_then(Value::as_str) {
            Some(e) => (e.to_string(), true),
            None => (v.get("resultat").and_then(Value::as_str).unwrap_or("").to_string(), false),
        },
        Err(_) => ("Plume n'a pas répondu à temps (l'application est-elle ouverte sur l'accueil ?).".to_string(), true),
    };
    json!({ "content": [{ "type": "text", "text": texte }], "isError": echec })
}

fn outil(nom: &str, description: &str, proprietes: Value, requis: &[&str]) -> Value {
    json!({ "name": nom, "description": description, "inputSchema": { "type": "object", "properties": proprietes, "required": requis } })
}

fn outils() -> Vec<Value> {
    let id = json!({ "type": "string", "description": "Identifiant du document (donné par lister_documents)" });
    vec![
        outil("lister_documents", "Liste les documents de Plume (Texte, Tableur, Présentation) avec leur identifiant, titre, type et date de modification.",
            json!({ "recherche": { "type": "string", "description": "Filtre facultatif sur le titre" } }), &[]),
        outil("lire_document", "Lit le contenu d'un document : Markdown pour un Texte, une table par feuille (séparée par des tabulations) pour un Tableur, le texte de chaque diapositive pour une Présentation.",
            json!({ "id": id }), &["id"]),
        outil("creer_document", "Crée un document et l'ouvre dans un onglet de Plume. Renvoie son identifiant.",
            json!({
                "type": { "type": "string", "enum": ["texte", "tableur", "presentation"] },
                "titre": { "type": "string" },
                "contenu": { "type": "string", "description": "Facultatif. Texte : Markdown. Tableur : CSV (séparateur ; ou ,) ou TSV. Présentation : plan, une diapositive par bloc, blocs séparés par une ligne vide (ou commençant par # ) ; dans chaque bloc, la 1re ligne est le titre et les suivantes des puces (- texte ; 2 espaces de retrait = sous-niveau)." }
            }), &["type", "titre"]),
        outil("ouvrir_document", "Affiche un document à l'écran, dans son onglet.", json!({ "id": id }), &["id"]),
        outil("ajouter_texte", "Texte : ajoute du contenu (Markdown) à la fin ou au début du document.",
            json!({ "id": id, "texte": { "type": "string", "description": "Markdown" }, "position": { "type": "string", "enum": ["fin", "debut"] } }), &["id", "texte"]),
        outil("reecrire_document", "Texte : remplace tout le contenu du document par ce Markdown (la mise en page et les styles du document sont gardés).",
            json!({ "id": id, "texte": { "type": "string", "description": "Markdown" } }), &["id", "texte"]),
        outil("remplacer_texte", "Texte ou Présentation : remplace toutes les occurrences d'un texte.",
            json!({ "id": id, "chercher": { "type": "string" }, "remplacer": { "type": "string" } }), &["id", "chercher", "remplacer"]),
        outil("modifier_cellules", "Tableur : écrit des valeurs ou des formules dans des cellules. Les formules commencent par = et utilisent les noms français (SOMME, MOYENNE, SI…) avec ; comme séparateur.",
            json!({ "id": id, "cellules": { "type": "object", "description": "Exemple : {\"A1\": \"Total\", \"B1\": \"=SOMME(B2:B10)\", \"C3\": 12.5}", "additionalProperties": true }, "feuille": { "type": "string", "description": "Nom de la feuille (par défaut : la feuille active)" } }), &["id", "cellules"]),
        outil("ajouter_diapositives", "Présentation : ajoute des diapositives à la fin, à partir d'un plan : une diapositive par bloc, blocs séparés par une ligne vide (ou commençant par # ) ; dans chaque bloc, la 1re ligne est le titre et les suivantes des puces (- texte ; 2 espaces de retrait = sous-niveau).",
            json!({ "id": id, "plan": { "type": "string" } }), &["id", "plan"]),
        outil("renommer_document", "Change le titre d'un document.", json!({ "id": id, "titre": { "type": "string" } }), &["id", "titre"]),
        outil("exporter_document", "Enregistre le document comme fichier dans Documents\\Plume (sans jamais écraser un fichier existant). Formats : Texte docx, odt, html, md, txt, rtf, epub, plume ; Tableur xlsx, csv, tsv, html, json, md, plume ; Présentation pptx, plume.",
            json!({ "id": id, "format": { "type": "string" } }), &["id"]),
        outil("supprimer_document", "Supprime définitivement un document de Plume (ferme son onglet s'il est ouvert).", json!({ "id": id }), &["id"]),
    ]
}
