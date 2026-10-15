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

function parseDeviceLines(raw) {
  // "Device XX:XX:XX:XX:XX:XX Some Name" per line
  return raw.split("\n").map(l => {
    const m = l.match(/^Device\s+([0-9A-Fa-f:]{17})\s+(.*)$/)
    return m ? { mac: m[1], name: m[2] } : null
  }).filter(Boolean)
}

export function BluetoothPopup() {
  let settingPower = false
  let lastPowered = null

  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 10, width_request: 340 })

  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file("/home/worst_poet/.config/ags/icons/bluetooth.svg")
  headerIcon.set_pixel_size(22)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  const titleLabel = new Gtk.Label({ css_classes: ["popup-title"], label: "Bluetooth", xalign: 0 })
  const subtitleLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "--", xalign: 0 })
  headerText.append(titleLabel); headerText.append(subtitleLabel)
  const powerSwitch = new Gtk.Switch({ css_classes: ["popup-switch"], valign: Gtk.Align.CENTER })
  headerRow.append(headerIcon); headerRow.append(headerText); headerRow.append(powerSwitch)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const pairedCaption = new Gtk.Label({ css_classes: ["section-caption"], label: "PAIRED DEVICES", xalign: 0 })
  root.append(pairedCaption)
  const pairedList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  root.append(pairedList)

  const availCaption = new Gtk.Label({ css_classes: ["section-caption"], label: "AVAILABLE DEVICES", xalign: 0 })
  root.append(availCaption)
  const availList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  // Nearby scans can turn up 15-20+ unnamed devices, which used to stretch
  // the popup a full screen tall. Capped to ~4 rows (28px row + 2px spacing
  // each) with natural sizing below that, so a short list doesn't leave
  // dead space and a long one scrolls instead of growing the window.
  const availScroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    max_content_height: 124,
    propagate_natural_height: true,
  })
  availScroll.set_child(availList)
  root.append(availScroll)

  // bluetoothd keeps its known-device cache (paired + previously-seen
  // devices) even while the radio is powered off, so "bluetoothctl devices"
  // still returns entries with the adapter down. Shown as-is that reads as
  // "devices are still reachable" when they're not, so the sections are
  // hidden entirely while off instead of rendering stale/unconnectable rows.
  const offHint = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "Turn on Bluetooth to see devices", xalign: 0, visible: false })
  root.append(offHint)

  function deviceRow(name, mac, connected) {
    const btn = new Gtk.Button({ css_classes: ["net-row"] })
    const inner = new Gtk.Box({ spacing: 8 })
    const label = new Gtk.Label({ css_classes: connected ? ["net-row-ssid", "net-row-active"] : ["net-row-ssid"], label: name + (connected ? "  •  Connected" : ""), xalign: 0, hexpand: true })
    inner.append(label)
    btn.set_child(inner)
    return btn
  }

  function clearBox(box) {
    let c = box.get_first_child()
    while (c) { const n = c.get_next_sibling(); box.remove(c); c = n }
  }

  function refresh() {
    const poweredOut = exec("bluetoothctl show")
    const powered = poweredOut.includes("Powered: yes")
    subtitleLabel.set_label(powered ? "ON" : "OFF")
    settingPower = true
    powerSwitch.set_active(powered)
    settingPower = false

    clearBox(pairedList); clearBox(availList)

    pairedCaption.set_visible(powered)
    pairedList.set_visible(powered)
    availCaption.set_visible(powered)
    availScroll.set_visible(powered)
    offHint.set_visible(!powered)

    // Layer-shell surfaces don't renegotiate their size while already
    // mapped, so shrinking (or regrowing) the visible sections above left a
    // stale-sized window with dead space. A hide/show remap forces GTK to
    // recompute natural size on next map, same as a fresh open already does
    // correctly. Only do this on an actual on/off transition, not every
    // refresh (device list/connect actions call refresh() too).
    if (lastPowered !== null && lastPowered !== powered) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
        win.visible = false
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => { win.visible = true; return GLib.SOURCE_REMOVE })
        return GLib.SOURCE_REMOVE
      })
    }
    lastPowered = powered

    if (!powered) return

    const paired = parseDeviceLines(exec("bluetoothctl devices Paired"))
    const all = parseDeviceLines(exec("bluetoothctl devices"))
    const pairedMacs = new Set(paired.map(d => d.mac))

    paired.forEach(d => {
      const info = exec(`bluetoothctl info ${d.mac}`)
      const connected = info.includes("Connected: yes")
      const row = deviceRow(d.name, d.mac, connected)
      row.hexpand = true
      row.connect("clicked", () => {
        execShAsync(`bluetoothctl ${connected ? "disconnect" : "connect"} ${d.mac}`)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => { refresh(); return GLib.SOURCE_REMOVE })
      })
      const forget = new Gtk.Button({ css_classes: ["net-row", "net-row-lock"], label: "󰆴", tooltip_text: "Forget device" })
      forget.connect("clicked", () => {
        execShAsync(`bluetoothctl remove ${d.mac}`)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { refresh(); return GLib.SOURCE_REMOVE })
      })
      const line = new Gtk.Box({ spacing: 4 })
      line.append(row)
      line.append(forget)
      pairedList.append(line)
    })

    all.filter(d => !pairedMacs.has(d.mac)).forEach(d => {
      const row = deviceRow(d.name, d.mac, false)
      row.connect("clicked", () => {
        execShAsync(`bluetoothctl pair ${d.mac} && bluetoothctl trust ${d.mac} && bluetoothctl connect ${d.mac}`)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => { refresh(); return GLib.SOURCE_REMOVE })
      })
      availList.append(row)
    })
  }

  powerSwitch.connect("state-set", (_sw, state) => {
    if (!settingPower) {
      execShAsync(`bluetoothctl power ${state ? "on" : "off"}`)
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => { refresh(); return GLib.SOURCE_REMOVE })
    }
    return false
  })

  const win = new Astal.Window({
    application: app,
    name: "bluetooth-popup",
    namespace: "bluetooth-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })
  win.set_child(root)

  win.connect("notify::visible", () => {
    if (win.visible) {
      refresh()
      execShAsync("bluetoothctl --timeout 5 scan on")
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5500, () => { if (win.visible) refresh(); return GLib.SOURCE_REMOVE })
    }
  })

  return win
}
