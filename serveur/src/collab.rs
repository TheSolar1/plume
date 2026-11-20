//! Coédition en temps réel : même protocole que VEX (src/plume/collab.rs).
//! Le serveur garde, par session, une copie du document et la suite des
//! modifications ; il n'en comprend pas le contenu. Tout est en mémoire.

use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::time::{SystemTime, UNIX_EPOCH};

/// Une session inactive depuis 24 h est oubliée à la création suivante.
const DUREE_SALLE_MS: u64 = 24 * 3600 * 1000;
const SALLES_MAX: usize = 40;
const ETAPES_MAX_PAR_ENVOI: usize = 2000;
/// Un participant sans nouvelles depuis 8 s n'est plus montré aux autres.
const PRESENCE_MS: u64 = 8000;
/// Au-delà, on demande un instantané au client pour alléger l'historique.
const ETAPES_AVANT_INSTANTANE: usize = 200;

pub fn refus(erreur: &str) -> Value {
    json!({ "ok": false, "error": erreur })
}

#[derive(Default)]
pub struct Salles(HashMap<String, Salle>);

struct Salle {
    instantane: Value,
    version_instantane: u64,
    /// (étape, client qui l'a envoyée)
    etapes: Vec<(Value, i64)>,
    meta: Option<Value>,
    version_meta: u64,
    meta_par: i64,
    suivant: i64,
    pairs: BTreeMap<i64, Pair>,
    touchee: u64,
}

struct Pair {
    cle: String,
    nom: String,
    a: Option<i64>,
    h: Option<i64>,
    vu: u64,
}

impl Salle {
    fn version(&self) -> u64 {
        self.version_instantane + self.etapes.len() as u64
    }

    fn rejoindre(&mut self, nom: &str, maintenant: u64) -> (i64, String) {
        let client = self.suivant;
        self.suivant += 1;
        let cle = cle(16);
        let pair = Pair { cle: cle.clone(), nom: nom.to_owned(), a: None, h: None, vu: maintenant };
        self.pairs.insert(client, pair);
        (client, cle)
    }

    fn etapes_depuis(&self, debut: usize) -> Value {
        self.etapes[debut..].iter().map(|(s, c)| json!({ "s": s, "c": c })).collect()
    }
}

impl Salles {
    pub fn traiter(&mut self, q: &Value) -> Value {
        let maintenant = maintenant_ms();
        let nom = nom_affiche(q.get("name"));
        let action = q.get("action").and_then(Value::as_str);

        if action == Some("create") {
            let Some(doc) = q.get("doc").filter(|d| est_objet(d)) else { return refus("doc") };
            self.0.retain(|_, s| maintenant.saturating_sub(s.touchee) <= DUREE_SALLE_MS);
            let id = q.get("id").filter(|v| vrai(v)).map(chaine_js).unwrap_or_else(|| cle(9));
            if !id_valide(&id) {
                return refus("id");
            }
            if self.0.contains_key(&id) {
                return refus("exists");
            }
            if self.0.len() >= SALLES_MAX {
                return refus("full");
            }
            let mut salle = Salle {
                instantane: doc.clone(),
                version_instantane: 0,
                etapes: Vec::new(),
                meta: None,
                version_meta: 0,
                meta_par: 0,
                suivant: 1,
                pairs: BTreeMap::new(),
                touchee: maintenant,
            };
            let (client, cle) = salle.rejoindre(&nom, maintenant);
            self.0.insert(id.clone(), salle);
            return json!({ "ok": true, "id": id, "client": client, "key": cle, "version": 0 });
        }

        let id = q.get("id").filter(|v| vrai(v)).map(chaine_js).unwrap_or_default();
        let Some(salle) = self.0.get_mut(&id) else {
            let connue = matches!(action, Some("join" | "sync" | "snapshot" | "leave"));
            return refus(if connue { "gone" } else { "action" });
        };

        if action == Some("join") {
            salle.touchee = maintenant;
            let (client, cle) = salle.rejoindre(&nom, maintenant);
            return json!({
                "ok": true,
                "client": client,
                "key": cle,
                "snapshot": salle.instantane,
                "snapVersion": salle.version_instantane,
                "steps": salle.etapes_depuis(0),
                "version": salle.version(),
                "meta": salle.meta,
                "metaVersion": salle.version_meta,
            });
        }
        if !matches!(action, Some("sync" | "snapshot" | "leave")) {
            return refus("action");
        }

        let cle_recue = q.get("key").and_then(Value::as_str);
        let client = match q.get("client").and_then(entier) {
            Some(c) if salle.pairs.get(&c).is_some_and(|p| cle_recue == Some(p.cle.as_str())) => c,
            _ => return refus("rejoin"),
        };
        if action == Some("leave") {
            salle.pairs.remove(&client);
            return json!({ "ok": true });
        }
        salle.touchee = maintenant;
        let actuelle = salle.version();
        let v = match q.get("version").and_then(entier) {
            Some(v) if v >= salle.version_instantane as i64 && v <= actuelle as i64 => v as u64,
            _ => return refus("resync"),
        };

        if action == Some("snapshot") {
            let Some(doc) = q.get("doc").filter(|d| est_objet(d)) else { return refus("doc") };
            if v > salle.version_instantane {
                salle.etapes.drain(..(v - salle.version_instantane) as usize);
                salle.instantane = doc.clone();
                salle.version_instantane = v;
            }
            return json!({ "ok": true, "snapVersion": salle.version_instantane });
        }

        // sync : position du curseur, étapes envoyées, métadonnées partagées.
        let sel = q.get("sel").filter(|s| vrai(s));
        let position = |k: &str| sel.and_then(|s| s.get(k)).and_then(entier);
        if let Some(moi) = salle.pairs.get_mut(&client) {
            moi.vu = maintenant;
            moi.a = position("a");
            moi.h = position("h");
        }
        let envoyees = q.get("steps").and_then(Value::as_array).filter(|e| !e.is_empty());
        if let Some(etapes) = envoyees {
            if etapes.len() > ETAPES_MAX_PAR_ENVOI {
                return refus("toobig");
            }
            if v == actuelle {
                salle.etapes.extend(etapes.iter().map(|s| (s.clone(), client)));
            }
        }
        if let Some(meta) = q.get("meta").filter(|m| est_objet(m)) {
            salle.meta = Some(meta.clone());
            salle.version_meta += 1;
            salle.meta_par = client;
        }
        let pairs: Vec<Value> = salle
            .pairs
            .iter()
            .filter(|(c, p)| **c != client && maintenant.saturating_sub(p.vu) < PRESENCE_MS)
            .map(|(c, p)| json!({ "c": c, "name": p.nom, "a": p.a, "h": p.h }))
            .collect();
        let mut sortie = json!({
            "ok": true,
            "version": salle.version(),
            "steps": salle.etapes_depuis((v - salle.version_instantane) as usize),
            "peers": pairs,
            "metaVersion": salle.version_meta,
            "wantSnapshot": salle.etapes.len() > ETAPES_AVANT_INSTANTANE && envoyees.is_none(),
        });
        let meta_client = q.get("metaVersion").filter(|m| vrai(m)).and_then(Value::as_f64).unwrap_or(0.0);
        if let Some(meta) = &salle.meta {
            if salle.version_meta as f64 > meta_client && salle.meta_par != client {
                sortie["meta"] = meta.clone();
            }
        }
        sortie
    }
}

/// Nom montré aux autres : sans caractères de contrôle, 40 unités UTF-16 au plus.
fn nom_affiche(v: Option<&Value>) -> String {
    let brut = v.filter(|v| vrai(v)).map(chaine_js).unwrap_or_default();
    let mut nom = String::new();
    let mut unites = 0;
    for c in brut.chars().filter(|c| u32::from(*c) >= 0x20) {
        unites += c.len_utf16();
        if unites > 40 {
            break;
        }
        nom.push(c);
    }
    match nom.trim() {
        "" => "Invité".to_owned(),
        n => n.to_owned(),
    }
}

fn id_valide(id: &str) -> bool {
    (8..=40).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

fn cle(octets: usize) -> String {
    let mut tampon = vec![0u8; octets];
    getrandom::fill(&mut tampon).expect("générateur aléatoire du système");
    tampon.iter().map(|o| format!("{o:02x}")).collect()
}

fn maintenant_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

/// Objet ou tableau (typeof === 'object' et non null en JavaScript).
fn est_objet(v: &Value) -> bool {
    v.is_object() || v.is_array()
}

/// Entier au sens de Number.isInteger : 1 et 1.0 sont acceptés.
fn entier(v: &Value) -> Option<i64> {
    v.as_i64()
        .or_else(|| v.as_f64().filter(|f| f.fract() == 0.0 && f.abs() < 9.0e15).map(|f| f as i64))
}

/// Valeur « vraie » au sens de JavaScript.
fn vrai(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// Conversion en texte au sens de String() en JavaScript.
fn chaine_js(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".to_owned(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::Array(a) => a
            .iter()
            .map(|x| if x.is_null() { String::new() } else { chaine_js(x) })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_owned(),
    }
}
