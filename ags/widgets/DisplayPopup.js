import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import app from "ags/gtk4/app"

function exec(cmd) {
  try {
    const [ok, out] = GLib.spawn_command_line_sync(cmd)
    return ok ? new TextDecoder().decode(out).trim() : ""
  } catch { return "" }
}

function execShAsync(cmd) {
  try {
    GLib.spawn_async(null, ["bash", "-c", cmd], null, GLib.SpawnFlags.SEARCH_PATH, null)
  } catch (e) {}
}

function SwitchRow(label) {
  const box = new Gtk.Box({ spacing: 8, valign: Gtk.Align.CENTER })
  const lbl = new Gtk.Label({ css_classes: ["section-caption"], label, hexpand: true, xalign: 0 })
  const sw = new Gtk.Switch({ css_classes: ["popup-switch"], valign: Gtk.Align.CENTER })
  box.append(lbl)
  box.append(sw)
  return { box, sw }
}

function SliderRow(label, lower, upper, initial, formatValue) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const topRow = new Gtk.Box({ spacing: 8 })
  const lbl = new Gtk.Label({ css_classes: ["section-caption"], label, hexpand: true, xalign: 0 })
  const val = new Gtk.Label({ css_classes: ["stat-value"], label: formatValue(initial), xalign: 1 })
  topRow.append(lbl); topRow.append(val)
  const adjustment = new Gtk.Adjustment({ lower, upper, step_increment: (upper - lower) / 100, value: initial })
  const scale = new Gtk.Scale({ css_classes: ["popup-slider"], orientation: Gtk.Orientation.HORIZONTAL, adjustment, draw_value: false, hexpand: true })
  box.append(topRow)
  box.append(scale)
  return { box, scale, adjustment, val }
}

const SCALES = [1, 1.25, 1.5, 1.75, 2]

function monitors() {
  const out = exec("hyprctl monitors -j")
  try { return JSON.parse(out) } catch { return [] }
}

export function DisplayPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 12, width_request: 320 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file(GLib.get_home_dir() + "/.config/ags/icons/display.svg")
  headerIcon.set_pixel_size(20)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  headerText.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Display", xalign: 0 }))
  const subtitleLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "--", xalign: 0 })
  headerText.append(subtitleLabel)
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const bright = SliderRow("BRIGHTNESS", 0, 100, 50, v => `${Math.round(v)}%`)
  root.append(bright.box)

  const textSize = SliderRow("TEXT SIZE", 0.8, 1.4, 1.0, v => `${Math.round(v * 12)}px`)
  root.append(textSize.box)

  // Lower K = warmer. wlsunset has no query command, so the last value
  // set here is cached to disk and restored on reopen — otherwise there's
  // no way to know what's actually applied when the popup reopens.
  const warmth = SliderRow("WARMTH", 2500, 6500, 6500, v => `${Math.round(v)}K`)
  root.append(warmth.box)

  const whitePoint = SwitchRow("REDUCE WHITE POINT")
  root.append(whitePoint.box)

  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "SCALE", xalign: 0 }))
  const scaleRow = new Gtk.Box({ spacing: 6, homogeneous: true })
  const scaleButtons = {}
  SCALES.forEach(s => {
    const btn = new Gtk.Button({ css_classes: ["dns-pill"], label: `${s}x` })
    scaleButtons[s] = btn
    btn.connect("clicked", () => {
      const mons = monitors()
      const focused = mons.find(m => m.focused) || mons[0]
      if (!focused) return
      execShAsync(`hyprctl keyword monitor "${focused.name},preferred,${focused.x}x${focused.y},${s}"`)
      Object.values(scaleButtons).forEach(b => b.remove_css_class("active"))
      btn.add_css_class("active")
    })
    scaleRow.append(btn)
  })
  root.append(scaleRow)

  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "DISPLAYS", xalign: 0 }))
  const displayList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  root.append(displayList)

  warmth.scale.set_inverted(true) // slide right = warmer (lower K), matches the other sliders' "right = more" feel

  let settingBright = false
  let settingText = false
  let settingWarmth = false
  let settingWhitePoint = false
  const WARMTH_CACHE = GLib.get_home_dir() + "/.cache/hypr-warmth-k"
  const WHITE_POINT_SHADER = GLib.get_home_dir() + "/.config/hypr/shaders/reduce-white-point.frag"

  function refreshWarmth() {
    const cached = exec(`cat ${WARMTH_CACHE} 2>/dev/null`)
    const v = parseInt(cached) || 6500
    settingWarmth = true
    warmth.adjustment.set_value(v)
    warmth.val.set_label(`${v}K`)
    settingWarmth = false
  }

  function refreshWhitePoint() {
    const current = exec("hyprctl getoption decoration:screen_shader").match(/^str:\s*(.*)$/m)
    settingWhitePoint = true
    whitePoint.sw.set_active(!!current && current[1].trim() === WHITE_POINT_SHADER)
    settingWhitePoint = false
  }

  function refreshBrightness() {
    const out = exec("brightnessctl -d amdgpu_bl1 -m")
    const parts = out.split(",")
    const v = parseInt(parts[3] || "0")
    settingBright = true
    bright.adjustment.set_value(v)
    bright.val.set_label(`${v}%`)
    settingBright = false
  }

  function refreshTextSize() {
    const out = exec("gsettings get org.gnome.desktop.interface text-scaling-factor")
    const v = parseFloat(out) || 1.0
    settingText = true
    textSize.adjustment.set_value(v)
    textSize.val.set_label(`${Math.round(v * 12)}px`)
    settingText = false
  }

  function refreshDisplays() {
    const mons = monitors()
    const focused = mons.find(m => m.focused)
    subtitleLabel.set_label(focused ? `${focused.width}×${focused.height} · ${focused.name}` : "--")

    Object.values(scaleButtons).forEach(b => b.remove_css_class("active"))
    if (focused) {
      const closest = SCALES.reduce((a, b) => Math.abs(b - focused.scale) < Math.abs(a - focused.scale) ? b : a)
      if (scaleButtons[closest]) scaleButtons[closest].add_css_class("active")
    }

    let child = displayList.get_first_child()
    while (child) { const next = child.get_next_sibling(); displayList.remove(child); child = next }
    mons.forEach(m => {
      const btn = new Gtk.Button({ css_classes: ["net-row"] })
      const row = new Gtk.Box({ spacing: 8 })
      const label = new Gtk.Label({
        css_classes: m.focused ? ["net-row-ssid", "net-row-active"] : ["net-row-ssid"],
        label: m.name, xalign: 0, hexpand: true,
      })
      row.append(label)
      if (m.focused) row.append(new Gtk.Label({ css_classes: ["list-check"], label: "✓" }))
      btn.set_child(row)
      btn.connect("clicked", () => {
        execShAsync(`hyprctl dispatch focusmonitor ${m.name}`)
        refreshDisplays()
      })
      displayList.append(btn)
    })
  }

  bright.adjustment.connect("value-changed", () => {
    if (settingBright) return
    const v = Math.round(bright.adjustment.get_value())
    bright.val.set_label(`${v}%`)
    execShAsync(`brightnessctl -d amdgpu_bl1 set ${v}%`)
  })

  textSize.adjustment.connect("value-changed", () => {
    if (settingText) return
    const v = textSize.adjustment.get_value()
    textSize.val.set_label(`${Math.round(v * 12)}px`)
    execShAsync(`gsettings set org.gnome.desktop.interface text-scaling-factor ${v.toFixed(2)}`)
  })

  warmth.adjustment.connect("value-changed", () => {
    if (settingWarmth) return
    const v = Math.round(warmth.adjustment.get_value())
    warmth.val.set_label(`${v}K`)
    // eDP-1 only (ThinkPad panel) -- see set-warmth.sh for why the Philips
    // monitor can't be scoped out of a plain hyprsunset temperature call.
    execShAsync(`${GLib.get_home_dir()}/.config/hypr/scripts/set-warmth.sh ${v}`)
  })

  whitePoint.sw.connect("state-set", (_sw, state) => {
    if (!settingWhitePoint) {
      execShAsync(`${GLib.get_home_dir()}/.config/hypr/scripts/set-white-point.sh ${state ? "on" : "off"}`)
    }
    return false
  })

  const win = new Astal.Window({
    application: app,
    name: "display-popup",
    namespace: "display-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })
  win.set_child(root)

  win.connect("notify::visible", () => {
    if (win.visible) { refreshBrightness(); refreshTextSize(); refreshWarmth(); refreshWhitePoint(); refreshDisplays() }
  })

  return win
}
