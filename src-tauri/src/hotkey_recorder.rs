//! Windows-only low-level keyboard hook used while the user is recording a
//! global shortcut. The webview never sees OS-reserved combos (Alt+Space,
//! Win+key, media keys), so during recording we install a WH_KEYBOARD_LL hook
//! that captures every keystroke before the system menu / Start menu reacts,
//! emits the resulting accelerator to the frontend, and swallows the key.
//!
//! Borrowed from Wox's `util/keyboard/listener_windows.c` approach.

use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostQuitMessage, PostThreadMessageW,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT, MSG,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

const VK_SHIFT: u32 = 0x10;
const VK_CONTROL: u32 = 0x11;
const VK_MENU: u32 = 0x12; // Alt
const VK_ESCAPE: u32 = 0x1B;
const VK_LWIN: u32 = 0x5B;
const VK_RWIN: u32 = 0x5C;

const EVENT_RECORDED: &str = "hotkey-recorded";
const EVENT_CANCEL: &str = "hotkey-recording-cancel";

static APP: OnceLock<AppHandle> = OnceLock::new();
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static ACTIVE: AtomicBool = AtomicBool::new(false);
static CAPTURED: AtomicBool = AtomicBool::new(false);

pub fn start(app: &AppHandle) -> Result<(), String> {
    let _ = APP.set(app.clone());

    // Already recording — nothing to do.
    if ACTIVE.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    CAPTURED.store(false, Ordering::SeqCst);

    std::thread::spawn(|| unsafe {
        HOOK_THREAD_ID.store(GetCurrentThreadId(), Ordering::SeqCst);

        let hmod = GetModuleHandleW(None).unwrap_or_default();
        let hook = match SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            HINSTANCE(hmod.0),
            0,
        ) {
            Ok(h) => h,
            Err(_) => {
                ACTIVE.store(false, Ordering::SeqCst);
                HOOK_THREAD_ID.store(0, Ordering::SeqCst);
                return;
            }
        };

        // WH_KEYBOARD_LL requires a message loop on the installing thread.
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).0 > 0 {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        let _ = UnhookWindowsHookEx(hook);
        ACTIVE.store(false, Ordering::SeqCst);
        HOOK_THREAD_ID.store(0, Ordering::SeqCst);
    });

    Ok(())
}

pub fn stop() {
    if !ACTIVE.load(Ordering::SeqCst) {
        return;
    }
    let tid = HOOK_THREAD_ID.load(Ordering::SeqCst);
    if tid != 0 {
        unsafe {
            let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
}

unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code == HC_ACTION as i32 {
        let msg = wparam.0 as u32;
        let kbd = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
        let vk = kbd.vkCode;
        let is_down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
        let is_up = msg == WM_KEYUP || msg == WM_SYSKEYUP;

        if is_down && !CAPTURED.load(Ordering::SeqCst) {
            // Bare Escape cancels recording.
            if vk == VK_ESCAPE && !any_modifier_pressed() {
                emit(EVENT_CANCEL, ());
                CAPTURED.store(true, Ordering::SeqCst);
                PostQuitMessage(0);
                return LRESULT(1);
            }

            // A real key plus at least one modifier forms an accelerator.
            if !is_modifier_vk(vk) {
                if let Some(acc) = build_accelerator(vk) {
                    emit(EVENT_RECORDED, acc);
                    CAPTURED.store(true, Ordering::SeqCst);
                }
            }
            // Swallow everything while recording (modifiers alone, bare keys,
            // and the captured combo) so Alt/Win don't trigger system menus.
            return LRESULT(1);
        }

        if is_up {
            // Once a combo is captured, tear down after all modifiers release
            // so a held Win key can't leak into the Start menu.
            if CAPTURED.load(Ordering::SeqCst) && !any_modifier_pressed() {
                PostQuitMessage(0);
            }
            return LRESULT(1);
        }

        // Swallow auto-repeat / extra key-downs after capture.
        if is_down {
            return LRESULT(1);
        }
    }

    CallNextHookEx(None, code, wparam, lparam)
}

fn emit<P: serde::Serialize + Clone>(event: &str, payload: P) {
    if let Some(app) = APP.get() {
        let _ = app.emit(event, payload);
    }
}

fn key_down(vk: u32) -> bool {
    unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
}

fn any_modifier_pressed() -> bool {
    key_down(VK_CONTROL)
        || key_down(VK_MENU)
        || key_down(VK_SHIFT)
        || key_down(VK_LWIN)
        || key_down(VK_RWIN)
}

fn is_modifier_vk(vk: u32) -> bool {
    matches!(
        vk,
        VK_SHIFT | VK_CONTROL | VK_MENU | VK_LWIN | VK_RWIN | 0xA0..=0xA5
    )
}

/// Build a Tauri accelerator string (e.g. "Ctrl+Shift+B", "Alt+Space").
/// Modifier order and key names mirror `src/api/shortcut.ts` so the result
/// round-trips through `register_shortcut`.
fn build_accelerator(vk: u32) -> Option<String> {
    let mut mods: Vec<&str> = Vec::new();
    if key_down(VK_CONTROL) {
        mods.push("Ctrl");
    }
    if key_down(VK_LWIN) || key_down(VK_RWIN) {
        mods.push("Super");
    }
    if key_down(VK_MENU) {
        mods.push("Alt");
    }
    if key_down(VK_SHIFT) {
        mods.push("Shift");
    }
    if mods.is_empty() {
        return None;
    }

    let key = key_name(vk)?;
    let mut parts = mods;
    parts.push(&key);
    Some(parts.join("+"))
}

fn key_name(vk: u32) -> Option<String> {
    // Letters A-Z
    if (0x41..=0x5A).contains(&vk) {
        return Some((vk as u8 as char).to_string());
    }
    // Digits 0-9 (top row)
    if (0x30..=0x39).contains(&vk) {
        return Some((vk as u8 as char).to_string());
    }
    // Function keys F1-F24
    if (0x70..=0x87).contains(&vk) {
        return Some(format!("F{}", vk - 0x70 + 1));
    }
    let named = match vk {
        0x20 => "Space",
        0x0D => "Enter",
        0x09 => "Tab",
        0x1B => "Escape",
        0x08 => "Backspace",
        0x2E => "Delete",
        0x2D => "Insert",
        0x24 => "Home",
        0x23 => "End",
        0x21 => "PageUp",
        0x22 => "PageDown",
        0x26 => "Up",
        0x28 => "Down",
        0x25 => "Left",
        0x27 => "Right",
        0xBD => "-",
        0xBB => "=",
        0xDB => "[",
        0xDD => "]",
        0xDC => "\\",
        0xBA => ";",
        0xDE => "'",
        0xBC => ",",
        0xBE => ".",
        0xBF => "/",
        0xC0 => "`",
        _ => return None,
    };
    Some(named.to_string())
}
