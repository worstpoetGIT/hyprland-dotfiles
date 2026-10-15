# 🌿 hyprland-dotfiles

> My personal Arch Linux setup — Hyprland (Lua config), Waybar, AGS popups, hyprlock, SDDM, and matugen, all in one place.

![Arch Linux](https://img.shields.io/badge/Arch_Linux-1793D1?style=for-the-badge&logo=arch-linux&logoColor=white)
![Hyprland](https://img.shields.io/badge/Hyprland-58E1FF?style=for-the-badge&logo=wayland&logoColor=black)
![Waybar](https://img.shields.io/badge/Waybar-333333?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

-----

## 📸 Preview

### Desktop

<img width="1920" height="1200" alt="5" src="https://github.com/user-attachments/assets/094fa22a-5c8f-448d-b741-5add425ee7d7" />


*Desktop with Waybar and matugen colors from the wallpaper*

### Lockscreen

<img width="1920" height="1200" alt="3" src="https://github.com/user-attachments/assets/0a9e7ec4-f2c0-47be-88c6-c9d283b5c0ec" />

*hyprlock on default config — analog clock, date, user avatar, and password field. Triggered automatically by hypridle after idle timeout*

-----

## ⚙️ What’s Inside

### 🪟 Hyprland (`hypr/`)

The core window manager config. Since Hyprland 0.55 the main config is written in **Lua** (`hyprland.lua`), replacing the old `hyprland.conf` / `hyprland-gui.conf` / `colors.conf` split.

|File                      |What it does                                                                                     |
|--------------------------|-------------------------------------------------------------------------------------------------|
|`hyprland.lua`            |Main config — keybinds, window rules, monitors, animations, startup apps. Active border color is read from matugen's palette|
|`hyprpaper.conf`          |Wallpaper setup via hyprpaper — defines which wallpaper loads on which monitor                   |
|`hypridle.conf`           |Idle management — dims screen, locks with hyprlock, suspends after configurable timeouts         |
|`hyprlock.conf`           |Lockscreen layout                                                                                |
|`shaders/`                |Screen shader for "Reduce White Point"                                                           |
|`toggle-fullscreen-all.sh`|Toggles fullscreen across all windows                                                            |
|`waybar-fullscreen.sh`    |Hides/shows Waybar when a window goes fullscreen                                                 |

-----

### 🛠️ Hyprland Scripts (`hypr/scripts/`)

Shell and Python scripts wired to keybinds or Waybar buttons.

|Script                    |What it does                                                         |
|--------------------------|---------------------------------------------------------------------|
|`brightness.sh`           |Controls screen brightness via keyboard shortcuts                    |
|`dock-resume.sh`          |Restores each monitor's workspace after docking/undocking            |
|`fan-gaming-watch.sh`     |Raises the ThinkPad fan level while a game is running                |
|`pseudo-maximize.sh`      |Maximize that keeps Waybar visible, flush to the other edges         |
|`screenrecord-toggle.sh`  |Starts and stops screen recording                                    |
|`session-start.sh`        |Runs on Hyprland startup — launches tray apps, sets environment, etc.|
|`set-warmth.sh`           |Color temperature for the laptop panel only (wlsunset)               |
|`set-white-point.sh`      |Turns Reduce White Point on/off (used by the AGS Display popup)      |
|`toggle-white-point.sh`   |Toggles Reduce White Point on all monitors                           |
|`update-sddm-colors.py`   |Pushes your current matugen palette to SDDM’s theme                  |
|`volume-adjust.sh`        |Changes volume and flashes the level in Waybar (replaces swayosd)    |
|`wallpaper-menu.sh`       |Interactive wallpaper picker                                         |

-----

### 📊 Waybar (`waybar/`)

A minimal status bar: workspaces on the left, clock in the center, and a row of icons on the right. Most icons open an AGS popup (below) instead of a Rofi menu.

|File          |What it does                                                       |
|--------------|-------------------------------------------------------------------|
|`config.jsonc`|Main Waybar layout — defines all modules, positions, and settings  |
|`style.css`   |Full CSS styling — colours, fonts, spacing, hover effects          |
|`colors.css`  |Color variables kept separate so matugen can overwrite them cleanly|
|`iOSBattery.ttf`|Custom font for iOS-style battery icons in the battery module    |

**Modules (right side):** sign out · Tailscale · LocalSend · Claude usage · Bluetooth · Wi-Fi · audio · display · accent picker · keyboard battery · battery · vitals · screen-record indicator

#### Waybar Scripts (`waybar/scripts/`)

|Script                     |What it does                                                       |
|---------------------------|-------------------------------------------------------------------|
|`accent-dot.py`            |Backend for the accent picker — lists matugen's source colors for the current wallpaper and applies the chosen one|
|`audio-status.sh`          |Volume icon; shows the level for ~2s after a volume key press      |
|`battery.sh`               |Outputs battery percentage and status                              |
|`clock.sh`                 |Center clock with date and a second (India) time zone              |
|`display-status.sh`        |Brightness icon; shows the level for ~2s after a brightness key press|
|`kb-battery.sh`            |Battery level of the wireless keyboard                             |
|`launch.sh`                |Starts/restarts Waybar                                             |
|`screenrecord-indicator.sh`|Shows a live dot in Waybar when screen recording is active         |
|`wallpaper-menu.sh`        |Wallpaper picker; reruns matugen on change                         |

-----

### 🧩 AGS popups (`ags/`)

[AGS](https://github.com/Aylur/ags) (GTK 4) powers the popups that open from Waybar modules. Colors come from matugen (`style/colors.css`).

|Popup               |What it does                                                         |
|--------------------|---------------------------------------------------------------------|
|`AccentPopup`       |**Accent picker** — choose which of matugen's source colors themes the desktop, remembered per wallpaper|
|`AudioPopup`        |Output device and volume                                             |
|`BatteryPopup`      |Battery health, time remaining, power profile                        |
|`BluetoothPopup`    |Paired/connected devices                                             |
|`CalendarPopup`     |Calendar from the clock                                              |
|`ClaudeStatsPopup`  |Claude Code usage from a self-hosted dashboard (set your own URL)    |
|`DisplayPopup`      |Brightness, warmth, Reduce White Point                               |
|`LocalSendPopup`    |Send files to LocalSend devices                                      |
|`SessionPopup`      |Lock / logout / reboot / shutdown                                    |
|`TailscalePopup`    |Tailscale status                                                     |
|`VitalsPopup`       |CPU, RAM, temperatures                                               |
|`WifiPopup`         |Networks and DNS                                                     |

#### 🎯 Accent picker

Matugen can build a palette from any of the top 4 colors it finds in a wallpaper, but normally always picks the most dominant one. Click the palette icon in Waybar to see all of them and pick one; the choice is saved per wallpaper in `~/.config/matugen/choices.json`, and `matugen/apply.sh` reapplies it every time that wallpaper is set.

-----

### 🔒 Lockscreen (hyprlock)

Configured in `hypr/hyprlock.conf` — analog clock, date, user avatar, and password input. Triggered automatically by **hypridle** after idle timeout.

The idle chain:

```
Idle detected → Screen dims → hyprlock activates → Screen suspends
```

Configured inside `hypr/hypridle.conf`.

-----

### 🖥️ SDDM (`sddm/`)

Display manager config for the login screen.

|File              |What it does                                                   |
|------------------|---------------------------------------------------------------|
|`sddm.conf`       |Main SDDM config — theme selection, autologin, session defaults|
|`sddm.conf.d.conf`|Drop-in override for fine-tuning without touching the main file|

Colors stay in sync with your wallpaper theme automatically via `update-sddm-colors.py`.

-----

### 🎨 Matugen (`matugen/`)

[Matugen](https://github.com/InioX/matugen) generates a full Material You palette from your wallpaper and pushes it across your entire setup in one command.

|File         |What it does                                                              |
|-------------|--------------------------------------------------------------------------|
|`config.toml`|Matugen settings — wallpaper input path, output targets, color scheme type|
|`apply.sh`   |Runs matugen with the accent color saved for the current wallpaper        |
|`templates/` |Template files for every app that receives generated colors               |

#### Apps themed by matugen

|Template           |App                            |
|-------------------|-------------------------------|
|`ags-colors.css`   |AGS (Aylur’s GTK Shell)        |
|`dunstrc`          |Dunst notification daemon      |
|`fastfetch.js`     |Fastfetch system info          |
|`fuzzel.ini`       |Fuzzel app launcher            |
|`rofi-colors`      |Rofi launcher                  |
|`sddm-colors`      |SDDM login screen              |
|`sddm-main.qm`     |SDDM main theme                |
|`swayosd.css`      |SwayOSD (volume/brightness OSD)|
|`vscodium-theme`   |VSCodium editor                |
|`waybar-colors.css`|Waybar status bar              |
|`yazi.toml`        |Yazi terminal file manager     |
|`btop.theme`       |btop system monitor            |

![IMG_6486](https://github.com/user-attachments/assets/3a389cbe-c1d7-4eb2-abb8-63ec9cb0cee2)

<img width="1920" height="1200" alt="3" src="https://github.com/user-attachments/assets/c83fdc74-4e4d-4573-9808-9d6c5bf21991" />
<img width="1920" height="1200" alt="2" src="https://github.com/user-attachments/assets/6049f538-35f9-43d1-8f73-77db6b5a05a3" />
<img width="1920" height="1200" alt="1" src="https://github.com/user-attachments/assets/67e5b209-52fe-4629-ba2c-bdf9ab60566e" />

Change your wallpaper and run:

```bash
~/.config/matugen/apply.sh /path/to/wallpaper.jpg
```

Every app in the list above gets new colors instantly.

-----

## 📦 Dependencies

```bash
paru -S hyprland hyprpaper hypridle hyprlock waybar sddm matugen \
        grim slurp playerctl pipewire wireplumber \
        fuzzel yazi fastfetch btop aylurs-gtk-shell wlsunset python
```

-----

## 🚀 Installation

> Back up your existing configs before doing this.

```bash
# Clone the repo
git clone git@github.com:worstpoetGIT/hyprland-dotfiles.git
cd hyprland-dotfiles

# Hyprland
cp -r hypr/* ~/.config/hypr/

# Waybar
cp -r waybar/* ~/.config/waybar/

# Matugen
cp -r matugen/* ~/.config/matugen/

# AGS popups
cp -r ags/* ~/.config/ags/

# SDDM (requires sudo)
sudo cp sddm/sddm.conf /etc/sddm.conf
sudo cp sddm/sddm.conf.d.conf /etc/sddm.conf.d/sddm.conf
```

Reload Hyprland: `SUPER + SHIFT + R`

-----

## 🎨 Applying a New Theme

```bash
~/.config/matugen/apply.sh /path/to/your/wallpaper.jpg
```

Or pick a different accent from the palette icon in Waybar. That’s it. Colors regenerate across Waybar, Hyprland, Rofi, Dunst, SDDM, and every other app in the template list.

-----

## 📁 Folder Structure

```
hyprland-dotfiles/
├── hypr/
│   ├── hyprland.lua
│   ├── hyprpaper.conf
│   ├── hypridle.conf
│   ├── hyprlock.conf
│   ├── shaders/
│   └── scripts/          (12 scripts)
├── waybar/
│   ├── config.jsonc
│   ├── style.css
│   ├── colors.css
│   ├── iOSBattery.ttf
│   └── scripts/          (9 scripts)
├── ags/
│   ├── app.js
│   ├── widgets/          (12 popups)
│   ├── style/
│   └── icons/
├── sddm/
│   ├── sddm.conf
│   └── sddm.conf.d.conf
├── matugen/
│   ├── config.toml
│   ├── apply.sh
│   └── templates/        (13 app templates)
└── README.md
```

-----

## 🙋 Notes

- Wallpaper symlinks (`current-wallpaper`, `current_wallpaper`) are excluded — they point to local paths that won’t work on other machines
- Backup files (`*.bak`, `*.save`, `backup-*` folders) and the per-wallpaper `choices.json` are excluded
- `ClaudeStatsPopup` points at `pidash.example.com` — replace it with your own endpoint or drop the popup
- If something breaks after cloning, check all dependencies are installed and paths in the configs match your username

-----

*Built on Arch. Runs on caffeine.*
