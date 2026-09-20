// Breeze Desktop — Tauri 2 main entry
// Lightweight Rust binary (~5MB) vs Electron (~150MB)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    breeze_desktop_lib::run();
}
