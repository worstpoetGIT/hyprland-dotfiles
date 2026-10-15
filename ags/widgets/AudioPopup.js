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

function SliderRow(label, initial) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const topRow = new Gtk.Box({ spacing: 8 })
  const lbl = new Gtk.Label({ css_classes: ["section-caption"], label, hexpand: true, xalign: 0 })
  const pct = new Gtk.Label({ css_classes: ["stat-value"], label: `${initial}%`, xalign: 1 })
  topRow.append(lbl); topRow.append(pct)
  const adjustment = new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1, value: initial })
  const scale = new Gtk.Scale({ css_classes: ["popup-slider"], orientation: Gtk.Orientation.HORIZONTAL, adjustment, draw_value: false, hexpand: true })
  box.append(topRow)
  box.append(scale)
  return { box, scale, adjustment, pct }
}

// pactl's raw "Name:"/"Description:" pairs come out in matching order per
// device block, so zipping the two line-arrays is enough — no need to parse
// full record boundaries. echo-cancel*/monitor-of-sink entries are pipewire
// filter-graph plumbing, not devices a person would pick, so they're dropped.
function listDevices(kind) {
  const out = exec(`pactl list ${kind}`)
  const names = []
  const descs = []
  out.split("\n").forEach(line => {
    let m
    if ((m = line.match(/^\tName: (.+)/))) names.push(m[1].trim())
    if ((m = line.match(/^\tDescription: (.+)/))) descs.push(m[1].trim())
  })
  const items = []
  for (let i = 0; i < names.length && i < descs.length; i++) {
    if (names[i].includes("echo-cancel")) continue
    if (kind === "sources" && names[i].endsWith(".monitor")) continue
    if (kind === "sinks" && names[i] === "effect_input.speaker_boost") continue
    if (kind === "sinks" && /HDMI[431]__sink$/.test(names[i])) continue
    let desc = descs[i]
    if (names[i].endsWith("HDMI2__sink")) desc = desc.replace("DisplayPort 2", "DisplayPort 1")
    items.push({ name: names[i], desc })
  }
  return items
}

function DeviceList() {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  return box
}

function renderDeviceList(box, items, activeName, onSelect) {
  let child = box.get_first_child()
  while (child) { const next = child.get_next_sibling(); box.remove(child); child = next }
  items.forEach(item => {
    const isActive = item.name === activeName
    const btn = new Gtk.Button({ css_classes: ["net-row"] })
    const row = new Gtk.Box({ spacing: 8 })
    const label = new Gtk.Label({
      css_classes: isActive ? ["net-row-ssid", "net-row-active"] : ["net-row-ssid"],
      label: item.desc, xalign: 0, hexpand: true,
    })
    row.append(label)
    if (isActive) row.append(new Gtk.Label({ css_classes: ["list-check"], label: "✓" }))
    btn.set_child(row)
    btn.connect("clicked", () => onSelect(item.name))
    box.append(btn)
  })
}

export function AudioPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 12, width_request: 320 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file(GLib.get_home_dir() + "/.config/ags/icons/audio.svg")
  headerIcon.set_pixel_size(20)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  headerText.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Audio", xalign: 0 }))
  const subtitleLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "--", xalign: 0 })
  headerText.append(subtitleLabel)
  const muteSwitch = new Gtk.Switch({ css_classes: ["popup-switch"], valign: Gtk.Align.CENTER })
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  headerRow.append(muteSwitch)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const outVol = SliderRow("OUTPUT", 50)
  root.append(outVol.box)
  const outList = DeviceList()
  root.append(outList)

  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const inVol = SliderRow("INPUT", 50)
  root.append(inVol.box)
  const inList = DeviceList()
  root.append(inList)

  let settingOutVol = false
  let settingInVol = false
  let settingMute = false

  function refreshOutput() {
    const out = exec("wpctl get-volume @DEFAULT_AUDIO_SINK@")
    const m = out.match(/([\d.]+)/)
    const v = m ? Math.round(parseFloat(m[1]) * 100) : 0
    const muted = out.includes("MUTED")
    settingOutVol = true
    outVol.adjustment.set_value(v)
    outVol.pct.set_label(`${v}%`)
    settingOutVol = false
    settingMute = true
    muteSwitch.set_active(!muted)
    settingMute = false

    const def = exec("pactl get-default-sink")
    const devices = listDevices("sinks")
    renderDeviceList(outList, devices, def, name => {
      execShAsync(`pactl set-default-sink '${name}'`)
      refreshOutput()
    })
    const active = devices.find(d => d.name === def)
    subtitleLabel.set_label(active ? active.desc.toUpperCase() : "NO OUTPUT DEVICE")
  }

  function refreshInput() {
    const out = exec("wpctl get-volume @DEFAULT_AUDIO_SOURCE@")
    const m = out.match(/([\d.]+)/)
    const v = m ? Math.round(parseFloat(m[1]) * 100) : 0
    settingInVol = true
    inVol.adjustment.set_value(v)
    inVol.pct.set_label(`${v}%`)
    settingInVol = false

    const def = exec("pactl get-default-source")
    const devices = listDevices("sources")
    renderDeviceList(inList, devices, def, name => {
      execShAsync(`pactl set-default-source '${name}'`)
      refreshInput()
    })
  }

  outVol.adjustment.connect("value-changed", () => {
    if (settingOutVol) return
    const v = Math.round(outVol.adjustment.get_value())
    outVol.pct.set_label(`${v}%`)
    execShAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${v}%`)
  })

  inVol.adjustment.connect("value-changed", () => {
    if (settingInVol) return
    const v = Math.round(inVol.adjustment.get_value())
    inVol.pct.set_label(`${v}%`)
    execShAsync(`wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${v}%`)
  })

  muteSwitch.connect("state-set", (_sw, state) => {
    if (!settingMute) execShAsync(`wpctl set-mute @DEFAULT_AUDIO_SINK@ ${state ? 0 : 1}`)
    return false
  })

  const win = new Astal.Window({
    application: app,
    name: "audio-popup",
    namespace: "audio-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })
  win.set_child(root)

  win.connect("notify::visible", () => {
    if (win.visible) { refreshOutput(); refreshInput() }
  })

  return win
}
