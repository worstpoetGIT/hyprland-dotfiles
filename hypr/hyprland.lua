-- Converted from ~/.config/hypr/hyprland.conf (hyprlang) to Lua for Hyprland 0.55+
-- Syntax verified against the official example (hyprwm/Hyprland/example/hyprland.lua)
-- and the 0.55.0 wiki (Dispatchers / Window-Rules / Layer-Rules / Devices / Gestures pages).
-- Items I could NOT verify against official docs are marked "-- VERIFY:" below.

-- Pulls the active border color from matugen's generated palette instead of
-- a hardcoded hex, so it tracks whatever wallpaper is set. Read fresh at
-- Hyprland startup/reload; wallpaper-menu.sh pushes updates live on change
-- via `hyprctl eval` (a static Lua read here wouldn't otherwise pick up a
-- wallpaper change mid-session).
local function matugen_primary_border()
    local f = io.open(os.getenv("HOME") .. "/.config/ags/style/colors.css", "r")
    if not f then return "rgba(94cdf7cc)" end
    local content = f:read("*a")
    f:close()
    local hex = content:match("@define%-color primary #(%x+);")
    return hex and ("rgba(" .. hex .. "cc)") or "rgba(94cdf7cc)"
end

-- Reduce White Point on/off state. `hyprctl eval`-ing decoration.screen_shader
-- directly is a transient override that a later `hyprctl reload` wipes back
-- to whatever's in this file -- and reload turned out to be required anyway,
-- to fix unfocused windows blinking between old/new frames on toggle. So the
-- state has to live on disk and get re-read here, same as the border color
-- above; set-white-point.sh writes the cache file then calls reload.
local function white_point_shader()
    local f = io.open(os.getenv("HOME") .. "/.cache/hypr-white-point-shader", "r")
    if not f then return "" end
    local content = f:read("*a")
    f:close()
    return content:gsub("%s+$", "")
end

------------------
---- MONITORS ----
------------------

-- Laptop panel default (also the fallback for anything not matched below).
-- Position is a fixed "0x2000" rather than "auto": eDP-1 is kept enabled at
-- all times now (see sync_dock_state() below) so DPMS can reliably wake it,
-- which means Hyprland's "auto" placement puts it side-by-side with
-- HDMI-A-1 in one continuous logical desktop instead of stacking it out of
-- the way -- confirmed live 2026-09-11: this let the mouse wander into
-- eDP-1's invisible (DPMS-off) region, which from the Philips looks like
-- input "randomly stops working" depending on cursor position. Pinning it
-- 2000px below HDMI-A-1 keeps it completely outside any reachable cursor
-- path while docked.
hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "0x2000",
    scale    = 1.25,
})

-- Philips 24E1N1200A: run it at its native 120Hz mode, no fractional
-- scaling (24" 1080p doesn't need it and 1.25 just blurs it via downsample).
-- Position pinned to the true origin "0x0" for the same reason as eDP-1
-- above -- explicit, not "auto", so it can never be reshuffled by the other
-- output's placement.
hl.monitor({
    output   = "HDMI-A-1",
    mode     = "1920x1080@120",
    position = "0x0",
    scale    = 1,
})

-- Dock/undock: the moment the external monitor is present, move all control
-- to it and blank the internal panel via DPMS so the lid can be closed
-- safely. Plugging back out wakes the laptop panel again. Bound to live
-- monitor add/remove events (not the lid switch itself) so it fires as soon
-- as the cable goes in, whether or not the lid is open.
--
-- Deliberately uses DPMS instead of `disabled = true/false`: disabling a
-- monitor at runtime tears down its CRTC, and re-enabling it afterward is a
-- known-unreliable Hyprland/aquamarine bug (confirmed by direct testing here
-- 2026-09-11 -- disabled=false on eDP-1 returns "ok" via both hl.monitor and
-- a full hyprctl reload, but the monitor stays disabled with DPMS stuck off
-- at the kernel level; matches long-standing upstream reports: hyprwm/
-- Hyprland issues #2549, #5557, discussions #14234, #14711). DPMS keeps the
-- monitor registered in Hyprland's state the whole time -- only its power
-- state changes -- which is what actually recovers cleanly on both ends.
-- eDP-1's own hl.monitor() entry above is intentionally left alone here: it
-- stays enabled at all times, so there's no descriptor to restore, only a
-- DPMS flip.

local function sync_dock_state()
    local has_external = false
    for _, m in ipairs(hl.get_monitors()) do
        if m.name == "HDMI-A-1" then
            has_external = true
        end
    end
    if has_external then
        hl.dispatch(hl.dsp.dpms({ action = "off", monitor = "eDP-1" }))
        -- eDP-1 stays "enabled" (just blanked) so it still counts as a real
        -- output to Hyprland, which means it keeps its own share of
        -- workspaces via the normal per-monitor distribution -- stranding
        -- some of them on the now-invisible panel while HDMI-A-1 only gets
        -- a fresh empty one (confirmed live 2026-09-11: workspaces 1/3/4
        -- ended up stuck on eDP-1, HDMI-A-1 only had 2). Sweep every
        -- workspace off eDP-1 onto the external monitor so nothing is ever
        -- left invisible.
        for _, ws in ipairs(hl.get_workspaces()) do
            if ws.monitor == "eDP-1" then
                hl.dispatch(hl.dsp.workspace.move({ workspace = tostring(ws.id), monitor = "HDMI-A-1" }))
            end
        end
    else
        hl.dispatch(hl.dsp.dpms({ action = "on", monitor = "eDP-1" }))
        -- Mirror image of the above: bring workspaces back to the laptop
        -- panel now that it's the only output left.
        for _, ws in ipairs(hl.get_workspaces()) do
            if ws.monitor == "HDMI-A-1" then
                hl.dispatch(hl.dsp.workspace.move({ workspace = tostring(ws.id), monitor = "eDP-1" }))
            end
        end
    end
end

hl.on("monitor.added", sync_dock_state)
hl.on("monitor.removed", sync_dock_state)
sync_dock_state() -- also apply on initial load/reload, in case it's already plugged in


---------------------
---- MY PROGRAMS ----
---------------------

local terminal    = "kitty"
local fileManager = "dolphin"
local menu        = "hyprlauncher"


-------------------
---- AUTOSTART ----
-------------------

hl.on("hyprland.start", function()
    hl.exec_cmd("~/.config/hypr/scripts/session-start.sh")
    hl.exec_cmd("/usr/lib/polkit-gnome/polkit-gnome-authentication-agent-1")
    hl.exec_cmd("echo powersave | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor")
    hl.exec_cmd("~/.config/hypr/waybar-fullscreen.sh")

    -- Audio input setup
    hl.exec_cmd('wpctl set-default $(pactl list short sources | grep "Mic1" | awk \'{print $1}\')')

    hl.exec_cmd("~/.config/ags/watch-wallpaper.sh")
    hl.exec_cmd("~/.config/ags/watch-ags.sh")
    hl.exec_cmd("python3 ~/bin/claude-paste-daemon.py")
    -- Warmth (eDP-1 only, see set-warmth.sh) -- restores whatever was last
    -- set via the AGS Display popup instead of always booting neutral.
    hl.exec_cmd("~/.config/hypr/scripts/set-warmth.sh $(cat ~/.cache/hypr-warmth-k 2>/dev/null || echo 6500)")

    -- Bumps EC fan level while a game is actually running, see the script
    -- for why process detection (Steam's reaper wrapper / wineserver) was
    -- used instead of a CPU/GPU load threshold.
    hl.exec_cmd("~/.config/hypr/scripts/fan-gaming-watch.sh")
    hl.exec_cmd("~/.config/hypr/scripts/dock-resume.sh")
end)


-------------------------------
---- ENVIRONMENT VARIABLES ----
-------------------------------

hl.env("XCURSOR_THEME", "MacOSX")
hl.env("XCURSOR_SIZE", "24")
hl.env("GDK_SCALE", "1")


-----------------------
----- PERMISSIONS -----
-----------------------

-- ecosystem { enforce_permissions = 1 } and permission = ... lines were commented
-- out in the original .conf, so left commented here too.

-- hl.config({
--   ecosystem = {
--     enforce_permissions = true,
--   },
-- })

-- hl.permission("/usr/(bin|local/bin)/grim", "screencopy", "allow")
-- hl.permission("/usr/(lib|libexec|lib64)/xdg-desktop-portal-hyprland", "screencopy", "allow")
-- hl.permission("/usr/(bin|local/bin)/hyprpm", "plugin", "allow")


-----------------------
---- LOOK AND FEEL ----
-----------------------

hl.config({
    general = {
        gaps_in  = 20,
        gaps_out = 100,

        border_size = 2,

        col = {
            active_border   = matugen_primary_border(),
            inactive_border = "rgba(ffffff1a)",
        },

        resize_on_border = false,
        allow_tearing    = false,

        layout = "dwindle",
    },

    decoration = {
        rounding = 12,

        screen_shader = white_point_shader(),

        shadow = {
            enabled      = false,
            range        = 20,
            render_power = 3,
            color        = "rgba(0000004d)",
        },

        blur = {
            enabled            = true,
            size               = 3,
            passes             = 1,
            new_optimizations  = true,
            xray               = false,
            ignore_opacity     = true,
        },
    },

    animations = {
        enabled = true,
    },
})

hl.layer_rule({ match = { namespace = "notifications" }, blur = true, ignore_alpha = 0.3, no_anim = true })

-- smoother curves
hl.curve("menuDecel",  { type = "bezier", points = { {0.05, 0.9}, {0.1, 1.0} } })
hl.curve("menuAccel",  { type = "bezier", points = { {0.3, 0.0},  {0.8, 0.15} } })
hl.curve("menuSmooth", { type = "bezier", points = { {0.22, 1.0}, {0.36, 1.0} } })
-- true ease-in-out (Material "standard easing") — for buttery window/workspace motion,
-- unlike menuSmooth's snap-then-coast shape
hl.curve("buttery",    { type = "bezier", points = { {0.4, 0.0},  {0.2, 1.0} } })

-- general
hl.animation({ leaf = "global", enabled = true, speed = 3, bezier = "menuSmooth" })

-- windows (fullscreen toggle animates via windowsMove/windows — smoothed per feedback)
hl.animation({ leaf = "windows",     enabled = true, speed = 3,   bezier = "buttery", style = "slide" })
hl.animation({ leaf = "windowsIn",   enabled = true, speed = 3,   bezier = "buttery", style = "slide" })
hl.animation({ leaf = "windowsOut",  enabled = true, speed = 2.5, bezier = "buttery", style = "slide" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 2.5, bezier = "buttery" })

-- fades
hl.animation({ leaf = "fade",    enabled = true, speed = 1.5, bezier = "menuSmooth" })
hl.animation({ leaf = "fadeIn",  enabled = true, speed = 1,   bezier = "menuDecel" })
hl.animation({ leaf = "fadeOut", enabled = true, speed = 1,   bezier = "menuAccel" })

-- workspaces — smoothed per feedback
hl.animation({ leaf = "workspaces", enabled = true, speed = 3, bezier = "buttery", style = "slidefade" })

-- IMPORTANT: this affects fuzzel/opening menus
hl.animation({ leaf = "layers",    enabled = true, speed = 2,   bezier = "menuSmooth", style = "slide" })
hl.animation({ leaf = "layersIn",  enabled = true, speed = 1.5, bezier = "menuDecel",  style = "slide" })
hl.animation({ leaf = "layersOut", enabled = true, speed = 1,   bezier = "menuAccel",  style = "slide" })

-- Ref https://wiki.hypr.land/Configuring/Basics/Workspace-Rules/
-- "Smart gaps" / "No gaps when only" — left commented, matching original
-- hl.workspace_rule({ workspace = "w[tv1]", gaps_out = 0, gaps_in = 0 })
-- hl.workspace_rule({ workspace = "f[1]",   gaps_out = 0, gaps_in = 0 })
-- hl.window_rule({
--     name  = "no-gaps-wtv1",
--     match = { float = false, workspace = "w[tv1]" },
--     border_size = 0,
--     rounding    = 0,
-- })
-- hl.window_rule({
--     name  = "no-gaps-f1",
--     match = { float = false, workspace = "f[1]" },
--     border_size = 0,
--     rounding    = 0,
-- })

hl.config({
    dwindle = {
        -- pseudotile = true -- master switch for pseudotiling, bound to mainMod + P below
        preserve_split = true,
    },

    master = {
        new_status = "master",
    },

    misc = {
        force_default_wallpaper   = 0,
        disable_hyprland_logo     = true,
        disable_splash_rendering  = true,
    },

    -- Disabled so waybar (top layer) stays visible over fullscreen windows —
    -- direct scanout bypasses normal layer compositing for performance,
    -- which is what was hiding the bar on Super+F.
    render = {
        direct_scanout = false,
    },
})


---------------
---- INPUT ----
---------------

hl.config({
    input = {
        kb_layout  = "gb",
        kb_variant = "",
        kb_model   = "",
        kb_options = "",
        kb_rules   = "",

        follow_mouse = 1,

        sensitivity   = 0.5, -- -1.0 - 1.0, 0 means no modification.
        accel_profile = "flat",

        touchpad = {
            natural_scroll = true,
        },
    },
})

-- Example per-device config
hl.device({
    name          = "hs6209-2.4g-wireless-receiver-mouse",
    sensitivity   = 1.0,
    accel_profile = "flat",
})

-- VERIFY: the original .conf had a per-device 3-finger swipe gesture bound
-- directly to the "movewindow" dispatcher, scoped to this one mouse:
--   device { name = hs6209-...; gesture = 3, left, dispatcher, movewindow, l; gesture = 3, right, dispatcher, movewindow, r }
-- The 0.55 Lua Gestures docs only document hl.gesture({...}) as a *global*
-- config (not scoped to a specific device), though `action` can be a Lua
-- function for custom dispatches. Closest documented equivalent below —
-- confirm against https://wiki.hypr.land/Configuring/Advanced-and-Cool/Gestures/
-- once you're actually on 0.55+, since device-scoping may not carry over.
hl.gesture({ fingers = 3, direction = "left",  action = function() hl.dispatch(hl.dsp.window.move({ direction = "l" })) end })
hl.gesture({ fingers = 3, direction = "right", action = function() hl.dispatch(hl.dsp.window.move({ direction = "r" })) end })


---------------------
---- KEYBINDINGS ----
---------------------

local mainMod = "SUPER" -- Sets "Windows" key as main modifier

hl.bind(mainMod .. " + T", hl.dsp.exec_cmd(terminal))
hl.bind(mainMod .. " + Q", hl.dsp.window.close())
hl.bind(mainMod .. " + D", hl.dsp.exec_cmd("rofi -show drun -theme ~/.config/rofi/glass-theme.rasi -theme-str 'window { width: 420px; border-radius: 12px; } listview { lines: 6; } configuration { show-icons: true; icon-theme: \"Papirus-Dark\"; }'"))
hl.bind(mainMod .. " + P", hl.dsp.window.pseudo())            -- dwindle
hl.bind(mainMod .. " + J", hl.dsp.layout("togglesplit"))      -- dwindle
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd("~/.config/waybar/scripts/launch.sh"))
hl.bind("XF86MonBrightnessUp",   hl.dsp.exec_cmd("~/.config/hypr/scripts/brightness.sh up"),   { locked = true, repeating = true })
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("~/.config/hypr/scripts/brightness.sh down"), { locked = true, repeating = true })
hl.bind("XF86AudioRaiseVolume",  hl.dsp.exec_cmd("~/.config/hypr/scripts/volume-adjust.sh raise"),       { locked = true, repeating = true })
hl.bind("XF86AudioLowerVolume",  hl.dsp.exec_cmd("~/.config/hypr/scripts/volume-adjust.sh lower"),       { locked = true, repeating = true })
hl.bind("XF86AudioMute",         hl.dsp.exec_cmd("~/.config/hypr/scripts/volume-adjust.sh mute-toggle"), { locked = true, repeating = true })
hl.bind(mainMod .. " + W", hl.dsp.exec_cmd("~/.config/rofi/wallpaper-menu.sh"))
hl.bind("CTRL + M", hl.dsp.exec_cmd("~/.config/rofi/hyprshot-menu.sh"))
-- Waybar popup toggles (mirrors the on-click ags toggle commands in waybar/config.jsonc)
hl.bind(mainMod .. " + SHIFT + T", hl.dsp.exec_cmd("ags toggle tailscale-popup"))
hl.bind(mainMod .. " + SHIFT + C", hl.dsp.exec_cmd("ags toggle claude-stats-popup"))
hl.bind(mainMod .. " + SHIFT + W", hl.dsp.exec_cmd("ags toggle wifi-popup"))
hl.bind(mainMod .. " + SHIFT + U", hl.dsp.exec_cmd("ags toggle bluetooth-popup"))
hl.bind(mainMod .. " + SHIFT + A", hl.dsp.exec_cmd("ags toggle audio-popup"))
hl.bind(mainMod .. " + SHIFT + D", hl.dsp.exec_cmd("ags toggle display-popup"))
hl.bind(mainMod .. " + SHIFT + B", hl.dsp.exec_cmd("ags toggle battery-popup"))
hl.bind(mainMod .. " + SHIFT + V", hl.dsp.exec_cmd("ags toggle vitals-popup"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.exec_cmd("ags toggle session-popup"))
hl.bind(mainMod .. " + SHIFT + N", hl.dsp.exec_cmd("ags toggle calendar-popup"))
hl.bind(mainMod .. " + SHIFT + L", hl.dsp.exec_cmd("ags toggle localsend-popup"))
hl.bind(mainMod .. " + K", hl.dsp.exec_cmd("python3 /opt/aula-f75/toggle_backlight.py"))
hl.bind("CTRL + E", hl.dsp.exec_cmd("~/.config/hypr/scripts/screenrecord-toggle.sh"))
hl.bind(mainMod .. " + L", hl.dsp.exit())
hl.bind(mainMod .. " + G", hl.dsp.exec_cmd("env XDG_CURRENT_DESKTOP=GNOME gnome-control-center"))
hl.bind(mainMod .. " + F1", hl.dsp.exec_cmd("hyprctl layers > /tmp/hypr-layers.txt"))
-- Native Hyprland maximize (fullscreen mode 1) respects waybar's reserved
-- space and gets clean square corners for free via the existing
-- no-round-fullscreen windowrule below (it matches on fullscreen=true,
-- which this sets). The old pseudo-maximize.sh workaround (float + manual
-- resize/move + per-window hl.dsp.window.set_prop override) is retired:
-- set_prop for rounding/border_size was confirmed non-functional in this
-- build -- accepts the call, returns "ok", never changes rendering (tested
-- at values up to 45/25 with zero visual effect) -- which is what caused
-- the rounded-corner bleed on every maximized window once gaps collapsed
-- to 0. A raw `hyprctl dispatch` of this exact call worked fine when
-- tested directly; if Super+F still doesn't fire it from a real keypress,
-- the dispatcher itself is proven fine and the bug is in hl.bind's keybind
-- wiring, not here.
hl.bind(mainMod .. " + F", hl.dsp.exec_cmd("~/.config/hypr/scripts/pseudo-maximize.sh"))
hl.bind(mainMod .. " + SHIFT + F", hl.dsp.exec_cmd("~/.config/hypr/toggle-fullscreen-all.sh"))

-- Move focus with mainMod + arrow keys
hl.bind(mainMod .. " + left",  hl.dsp.focus({ direction = "l" }))
hl.bind(mainMod .. " + right", hl.dsp.focus({ direction = "r" }))
hl.bind(mainMod .. " + up",    hl.dsp.focus({ direction = "u" }))
hl.bind(mainMod .. " + down",  hl.dsp.focus({ direction = "d" }))

-- Switch workspaces with mainMod + [0-9]
-- Move active window to a workspace with mainMod + SHIFT + [0-9]
--
-- A workspace that doesn't exist yet gets created on whatever monitor
-- Hyprland's own per-monitor distribution picks, which can be eDP-1 even
-- while docked -- and eDP-1 is DPMS-blanked while docked (see
-- sync_dock_state above), so that workspace opens invisibly. The dock-time
-- sweep only catches workspaces that already existed at the moment the
-- monitor was plugged in, not ones created afterward (confirmed live
-- 2026-10-07: workspace 6+ vanished onto the blanked panel). So every
-- number-key switch re-checks dock state and relocates if needed.
local function is_docked()
    for _, m in ipairs(hl.get_monitors()) do
        if m.name == "HDMI-A-1" then return true end
    end
    return false
end

local function goto_workspace(i)
    hl.dispatch(hl.dsp.focus({ workspace = i }))
    if is_docked() then
        hl.dispatch(hl.dsp.workspace.move({ workspace = tostring(i), monitor = "HDMI-A-1" }))
        hl.dispatch(hl.dsp.focus({ workspace = i }))
    end
end

local function move_window_to_workspace(i)
    hl.dispatch(hl.dsp.window.move({ workspace = i }))
    if is_docked() then
        hl.dispatch(hl.dsp.workspace.move({ workspace = tostring(i), monitor = "HDMI-A-1" }))
    end
end

for i = 1, 10 do
    local key = i % 10 -- 10 maps to key 0
    hl.bind(mainMod .. " + " .. key,         function() goto_workspace(i) end)
    hl.bind(mainMod .. " + SHIFT + " .. key, function() move_window_to_workspace(i) end)
end

-- Example special workspace (scratchpad) — left commented, matching original
-- hl.bind(mainMod .. " + S",         hl.dsp.workspace.toggle_special("magic"))
-- hl.bind(mainMod .. " + SHIFT + S", hl.dsp.window.move({ workspace = "special:magic" }))

-- Move/resize windows with mainMod + LMB/RMB and dragging
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(),   { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- Requires playerctl
hl.bind("XF86AudioNext",  hl.dsp.exec_cmd("playerctl next"),       { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPlay",  hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPrev",  hl.dsp.exec_cmd("playerctl previous"),   { locked = true })

hl.bind(mainMod .. " + C", hl.dsp.exec_cmd("~/.config/ags/reload-colors.sh"))


--------------------------------
---- WINDOWS AND WORKSPACES ----
--------------------------------

hl.window_rule({
    -- Ignore maximize requests from all apps. You'll probably like this.
    name  = "suppress-maximize-events",
    match = { class = ".*" },

    suppress_event = "maximize",
})

hl.window_rule({
    -- Fix some dragging issues with XWayland
    name  = "fix-xwayland-drags",
    match = {
        class      = "^$",
        title      = "^$",
        xwayland   = true,
        float      = true,
        fullscreen = false,
        pin        = false,
    },

    no_focus = true,
})

hl.window_rule({
    -- GTK/libadwaita and Chromium-based clients (Zen, etc.) mark their whole
    -- surface as one opaque region for their own CSD. Compositors skip the
    -- alpha-blended rounding/border cutout over anything a client declares
    -- opaque, so those windows render with hard square corners and no
    -- visible border no matter what decoration.rounding/border_size is set
    -- to. Forcing opaque=false makes Hyprland composite them normally so
    -- rounding and the matugen border actually show up.
    --
    -- Deliberately does NOT also force rounding here: Super+F now uses
    -- native fullscreen mode 1 (see the keybind above), which the
    -- no-round-fullscreen windowrule below already squares off via
    -- fullscreen=true, so this rule leaves rounding alone and just follows
    -- decoration.rounding (the global default), which is exactly what
    -- opaque=false unblocks for these clients.
    name  = "force-round-all",
    match = {},

    opaque = false,
})

hl.window_rule({
    -- Square off corners AND remove the border on fullscreen windows --
    -- rounding looks wrong and a border sitting right at the screen edge
    -- looks wrong too when a window fills the whole screen (no gap for
    -- either to read against).
    name  = "no-round-fullscreen",
    match = { fullscreen = true },

    rounding    = 0,
    border_size = 0,
})

-- Hyprland-run windowrule
hl.window_rule({
    name  = "move-hyprland-run",
    match = { class = "hyprland-run" },

    move  = "20 monitor_h-120",
    float = true,
})

hl.window_rule({
    name  = "dunst-noborder",
    match = { class = "dunst" },

    border_size = 0,
})

-- Blurs (was `blurls = ...` in hyprlang, now layer rules)
hl.layer_rule({ match = { namespace = "rofi" },                blur = true })
hl.layer_rule({ match = { namespace = "nwg-dock-hyprland" },   blur = true })


hl.config({
    xwayland = {
        force_zero_scaling = true,
    },
})
