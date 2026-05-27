// Runs via the npm "version" lifecycle hook after package.json is bumped.
// Syncs the new version into tauri.conf.json and Cargo.toml.

import { readFileSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

// tauri.conf.json — replace the "version" field value
const tauriConf = "src-tauri/tauri.conf.json";
writeFileSync(tauriConf, readFileSync(tauriConf, "utf8").replace(/"version":\s*"[^"]+"/, `"version": "${version}"`));

// Cargo.toml — replace only the first occurrence (the crate version, not dependency versions)
const cargoToml = "src-tauri/Cargo.toml";
writeFileSync(cargoToml, readFileSync(cargoToml, "utf8").replace(/^version = "[^"]+"/m, `version = "${version}"`));

console.log(`Synced version ${version} to tauri.conf.json and Cargo.toml`);
