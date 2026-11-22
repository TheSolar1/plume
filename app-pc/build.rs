// Intègre les pages de Plume (index, texte, présentation, tableur et dist/) au
// programme, et lui donne son icône et ses informations Windows.
use std::{env, fs, path::Path};

fn main() {
    // Lu à l'exécution (et non figé à la compilation du script) : suit le dossier s'il est déplacé.
    let manifeste = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let racine = Path::new(&manifeste).join("..");
    let mut fichiers: Vec<String> = ["index.html", "bureau.html", "texte.html", "presentation.html", "tableur.html"].map(String::from).to_vec();
    let dist = racine.join("dist");
    for e in fs::read_dir(&dist).expect("dist/ introuvable : lancez d'abord npm run build") {
        let e = e.expect("lecture de dist/");
        let nom = e.file_name().into_string().expect("nom de fichier");
        if e.path().is_file() && !nom.ends_with(".map") {
            fichiers.push(format!("dist/{nom}"));
        }
    }
    fichiers.sort();
    let mut code = String::from("static FICHIERS: &[(&str, &[u8])] = &[\n");
    for f in &fichiers {
        let chemin = racine.join(f);
        code.push_str(&format!("    ({f:?}, include_bytes!({:?})),\n", chemin.to_string_lossy()));
        println!("cargo:rerun-if-changed={}", chemin.display());
    }
    code.push_str("];\n");
    fs::write(Path::new(&env::var("OUT_DIR").expect("OUT_DIR")).join("fichiers.rs"), code).expect("écriture de fichiers.rs");
    println!("cargo:rerun-if-changed={}", dist.display());
    println!("cargo:rerun-if-changed=icone/plume.ico");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("icone/plume.ico")
            .set("FileDescription", "Plume")
            .set("ProductName", "Plume")
            .set("CompanyName", "Plume")
            .set("LegalCopyright", "Licence MIT");
        res.compile().expect("ressources Windows (icône)");
    }
}
