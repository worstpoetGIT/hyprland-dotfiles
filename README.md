# 🌿 hyprland-dotfiles

> My personal Arch Linux setup — Hyprland, Waybar, hyprlock, SDDM, and matugen, all in one place.

![Arch Linux](https://img.shields.io/badge/Arch_Linux-1793D1?style=for-the-badge&logo=arch-linux&logoColor=white)
![Hyprland](https://img.shields.io/badge/Hyprland-58E1FF?style=for-the-badge&logo=wayland&logoColor=black)
![Waybar](https://img.shields.io/badge/Waybar-333333?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

-----

## 📸 Preview

### Desktop

<img width="1920" height="1200" alt="5" src="https://github.com/user-attachments/assets/094fa22a-5c8f-448d-b741-5add425ee7d7" />


*Clean green-themed desktop with custom dock, workspace indicators, and left/right app panels*

### Sidebar Widgets

<img width="1920" height="1200" alt="1" src="https://github.com/user-attachments/assets/36cda5d2-fda9-41af-823b-b333a040c6fc" />

*Right sidebar showing the clock, calendar, Wi-Fi status, Bluetooth, and power profile — all triggered from Waybar*

### Screenshot Menu

<img width="1865" height="1179" alt="4" src="https://github.com/user-attachments/assets/01788c71-8c54-48f8-9470-fe0e85fb740b" />

*Custom screenshot picker via `screenshot-menu.sh` — choose between Region, Window, or Monitor capture*

### WiFi Menu

<img width="1870" height="1179" alt="2" src="https://github.com/user-attachments/assets/bf314211-eb6a-4dd1-8bdd-277cab74abcb" />

*Rofi-powered WiFi network picker, launched directly from the Waybar WiFi module*

### Lockscreen

<img width="1920" height="1200" alt="3" src="https://github.com/user-attachments/assets/0a9e7ec4-f2c0-47be-88c6-c9d283b5c0ec" />

*hyprlock on default config — analog clock, date, user avatar, and password field. Triggered automatically by hypridle after idle timeout*

-----

## ⚙️ What’s Inside

### 🪟 Hyprland (`hypr/`)

The core window manager config, split across multiple files to keep things clean.

|File               |What it does                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------|
|`hyprland.conf`    |Main config — keybinds, window rules, monitor setup, startup apps                            |
|`hyprland-gui.conf`|GUI-specific settings, animations, and decoration options                                    |
|`colors.conf`      |Centralised color variables sourced by other configs. Edit here to retheme everything at once|
|`hyprpaper.conf`   |Wallpaper setup via hyprpaper — defines which wallpaper loads on which monitor               |
|`hypridle.conf`    |Idle management — dims screen, locks with hyprlock, suspends after configurable timeouts     |

-----

### 🛠️ Hyprland Scripts (`hypr/scripts/`)

Shell and Python scripts wired to keybinds or Waybar buttons.

|Script                    |What it does                                                         |
|--------------------------|---------------------------------------------------------------------|
|`brightness.sh`           |Controls screen brightness via keyboard shortcuts                    |
|`control-panel.py`        |Launches a quick-access control panel UI                             |
|`fullscreen-waybar.sh`    |Toggles Waybar visibility when going fullscreen                      |
|`restore-wallpaper.sh`    |Restores the current wallpaper after a reload or crash               |
|`screenrecord-toggle.sh`  |Starts and stops screen recording                                    |
|`screenshot-menu.sh`      |Rofi-based screenshot picker — Region, Window, or Monitor            |
|`session-start.sh`        |Runs on Hyprland startup — launches tray apps, sets environment, etc.|
|`toggle-black.sh`         |Toggles a solid black overlay, useful for presentations              |
|`toggle-fullscreen-all.sh`|Toggles fullscreen across all windows                                |
|`update-sddm-colors.py`   |Pushes your current matugen palette to SDDM’s theme                  |
|`wallpaper-menu.sh`       |Interactive wallpaper picker                                         |
|`waybar-fullscreen.sh`    |Hides/shows Waybar when a window goes fullscreen                     |

-----

### 📊 Waybar (`waybar/`)

A heavily customised status bar with dynamic modules and its own script collection.

|File                      |What it does                                                       |
|--------------------------|-------------------------------------------------------------------|
|`config.jsonc`            |Main Waybar layout — defines all modules, positions, and settings  |
|`style.css`               |Full CSS styling — colours, fonts, spacing, hover effects          |
|`colors.css`              |Color variables kept separate so matugen can overwrite them cleanly|
|`iOSBattery.ttf`          |Custom font for iOS-style battery icons in the battery module      |
|`sounds/charging.mp3`     |Plays when the charger is plugged in                               |
|`icons/sidebar-toggle.svg`|Custom SVG icon for the sidebar toggle button                      |

#### Waybar Scripts (`waybar/scripts/`)

|Script                     |What it does                                                       |
|---------------------------|-------------------------------------------------------------------|
|`battery.sh`               |Outputs battery percentage and status                              |
|`batterypng.py`            |Generates a battery icon as PNG using the custom font              |
|`build_battery_font_ff.py` |Builds the battery font (Firefox-compatible)                       |
|`build_colr_battery.py`    |Builds a colour-layered battery icon                               |
|`bluetooth.sh`             |Shows Bluetooth status and connected device name                   |
|`brightness.sh`            |Outputs current brightness level                                   |
|`gpu-status.sh`            |Shows current GPU usage and temperature                            |
|`launch.sh`                |Generic launcher used by several Waybar buttons                    |
|`media.sh`                 |Displays currently playing media via playerctl                     |
|`power-profile-menu.sh`    |Rofi menu to switch power profiles (performance, balanced, battery)|
|`record.sh`                |Handles recording state for the recording indicator module         |
|`right-sidebar-toggle.sh`  |Toggles the right sidebar panel                                    |
|`screenrecord-indicator.sh`|Shows a live dot in Waybar when screen recording is active         |
|`screenshot.sh`            |Triggers a screenshot directly from the bar                        |
|`tlp-cycle.sh`             |Cycles through TLP power profiles                                  |
|`tlp-profile.sh`           |Shows the current TLP profile                                      |
|`volume-icon.sh`           |Outputs the right volume icon depending on level and mute state    |
|`wallpaper-menu.sh`        |Opens the wallpaper picker from the bar                            |
|`wifi-menu.sh`             |Rofi-based WiFi network picker                                     |
|`window-title.sh`          |Outputs the active window title                                    |

-----

### 🔒 Lockscreen (hyprlock)

Running on **hyprlock** defaults — analog clock, date, user avatar, and password input. Triggered automatically by **hypridle** after idle timeout.

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
![IMG_6486](https://github.com/user-attachments/assets/3a389cbe-c1d7-4eb2-abb8-63ec9cb0cee2)

<img width="1920" height="1200" alt="3" src="https://github.com/user-attachments/assets/c83fdc74-4e4d-4573-9808-9d6c5bf21991" />
<img width="1920" height="1200" alt="2" src="https://github.com/user-attachments/assets/6049f538-35f9-43d1-8f73-77db6b5a05a3" />
<img width="1920" height="1200" alt="1" src="https://github.com/user-attachments/assets/67e5b209-52fe-4629-ba2c-bdf9ab60566e" />
|`waybar-colors.css`|Waybar status bar              |
|`yazi.toml`        |Yazi terminal file manager     |

Change your wallpaper and run:

```bash
matugen image /path/to/wallpaper.jpg
```

Every app in the list above gets new colors instantly.

-----

## 📦 Dependencies

```bash
paru -S hyprland hyprpaper hypridle hyprlock waybar sddm matugen \
        rofi-wayland grim slurp playerctl tlp pipewire wireplumber \
        dunst fuzzel swayosd yazi fastfetch
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

# SDDM (requires sudo)
sudo cp sddm/sddm.conf /etc/sddm.conf
sudo cp sddm/sddm.conf.d.conf /etc/sddm.conf.d/sddm.conf
```

Reload Hyprland: `SUPER + SHIFT + R`

-----

## 🎨 Applying a New Theme

```bash
matugen image /path/to/your/wallpaper.jpg
```

That’s it. Colors regenerate across Waybar, Hyprland, Rofi, Dunst, SDDM, and every other app in the template list.

-----

## 📁 Folder Structure

```
hyprland-dotfiles/
├── assets/
│   ├── desktop.png
│   ├── sidebar.png
│   ├── screenshot-menu.png
│   ├── wifi-menu.png
│   └── lockscreen.png
├── hypr/
│   ├── hyprland.conf
│   ├── hyprland-gui.conf
│   ├── colors.conf
│   ├── hyprpaper.conf
│   ├── hypridle.conf
│   └── scripts/          (12 scripts)
├── waybar/
│   ├── config.jsonc
│   ├── style.css
│   ├── colors.css
│   ├── iOSBattery.ttf
│   ├── icons/
│   ├── sounds/
│   └── scripts/          (20 scripts)
├── sddm/
│   ├── sddm.conf
│   └── sddm.conf.d.conf
├── matugen/
│   ├── config.toml
│   └── templates/        (11 app templates)
└── README.md
```

-----

## 🙋 Notes

- Wallpaper symlinks (`current-wallpaper`, `current_wallpaper`) are excluded — they point to local paths that won’t work on other machines
- Backup files (`config.jsonc.save`, `hyprland.conf.save.1`) are excluded
- hyprlock runs on default config — no `hyprlock.conf` needed unless you want to customise it
- If something breaks after cloning, check all dependencies are installed and paths in the configs match your username

-----

*Built on Arch. Runs on caffeine.*
