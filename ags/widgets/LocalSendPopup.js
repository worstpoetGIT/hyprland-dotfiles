import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import Gio from "gi://Gio?version=2.0"
import app from "ags/gtk4/app"

function execShAsync(cmd) {
  try {
    GLib.spawn_async(null, ["bash", "-c", cmd], null, GLib.SpawnFlags.SEARCH_PATH, null)
  } catch (e) {}
}

function execCapture(argv, callback) {
  try {
    const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE)
    proc.communicate_utf8_async(null, null, (p, res) => {
      try {
        const [, stdout] = p.communicate_utf8_finish(res)
        callback(stdout || "")
      } catch (e) { callback("") }
    })
  } catch (e) { callback("") }
}

function ActionRow(icon, title, desc) {
  const btn = new Gtk.Button({ css_classes: ["net-row"] })
  const row = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const iconLabel = new Gtk.Label({ css_classes: ["popup-header-icon-material"], label: icon, valign: Gtk.Align.CENTER })
  const textBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1, hexpand: true })
  textBox.append(new Gtk.Label({ css_classes: ["stat-value"], label: title, xalign: 0 }))
  textBox.append(new Gtk.Label({ css_classes: ["stat-label"], label: desc, xalign: 0 }))
  row.append(iconLabel); row.append(textBox)
  btn.set_child(row)
  return btn
}

const DEST_DIR = GLib.get_home_dir() + "/Downloads"

export function LocalSendPopup() {
  let selectedTarget = null
  let peers = []

  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 12, width_request: 320 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file(GLib.get_home_dir() + "/.config/ags/icons/localsend.png")
  headerIcon.set_pixel_size(20)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  headerText.append(new Gtk.Label({ css_classes: ["popup-title"], label: "LocalSend", xalign: 0 }))
  const subtitleLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "--", xalign: 0 })
  headerText.append(subtitleLabel)
  const receiveSwitch = new Gtk.Switch({ css_classes: ["popup-switch"], valign: Gtk.Align.CENTER })
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  headerRow.append(receiveSwitch)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  // ── This device / Saving to ──
  const aliasRow = new Gtk.Box({ spacing: 8 })
  aliasRow.append(new Gtk.Label({ css_classes: ["stat-label"], label: "This device", xalign: 0, hexpand: true }))
  const aliasValue = new Gtk.Label({ css_classes: ["stat-value"], label: "--", xalign: 1 })
  aliasRow.append(aliasValue)
  root.append(aliasRow)

  const destRow = new Gtk.Box({ spacing: 8 })
  destRow.append(new Gtk.Label({ css_classes: ["stat-label"], label: "Saving to", xalign: 0, hexpand: true }))
  destRow.append(new Gtk.Label({ css_classes: ["stat-value"], label: DEST_DIR, xalign: 1 }))
  root.append(destRow)

  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  // ── Send ──
  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "SEND", xalign: 0 }))
  const sendFilesBtn = ActionRow("description", "Send files", "Pick files to send to a nearby device")
  const sendFolderBtn = ActionRow("folder", "Send folder", "Pick a folder to send")
  const sendClipboardBtn = ActionRow("content_paste", "Send clipboard", "Send whatever is currently copied")
  root.append(sendFilesBtn); root.append(sendFolderBtn); root.append(sendClipboardBtn)

  const statusLabel = new Gtk.Label({ css_classes: ["stat-label"], label: "", xalign: 0, visible: false })
  root.append(statusLabel)

  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  // ── Devices ──
  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "NEARBY DEVICES", xalign: 0 }))
  const peerList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  root.append(peerList)

  function clear(box) {
    let child = box.get_first_child()
    while (child) { const next = child.get_next_sibling(); box.remove(child); child = next }
  }

  function renderPeers() {
    clear(peerList)
    if (peers.length === 0) {
      peerList.append(new Gtk.Label({ css_classes: ["stat-label"], label: "Searching…", xalign: 0 }))
      return
    }
    peers.forEach(p => {
      const isSelected = p.alias === selectedTarget
      const btn = new Gtk.Button({ css_classes: ["net-row"] })
      const row = new Gtk.Box({ spacing: 8 })
      const label = new Gtk.Label({
        css_classes: isSelected ? ["net-row-ssid", "net-row-active"] : ["net-row-ssid"],
        label: p.alias, xalign: 0, hexpand: true,
      })
      const type = new Gtk.Label({ css_classes: ["net-row-lock"], label: p.deviceType || "", xalign: 1 })
      row.append(label); row.append(type)
      btn.set_child(row)
      btn.connect("clicked", () => { selectedTarget = p.alias; renderPeers() })
      peerList.append(btn)
    })
  }

  function refreshPeers() {
    execCapture(["lsq", "list", "--json", "--wait", "2", "--quiet"], out => {
      let data
      try { data = JSON.parse(out) } catch { data = [] }
      peers = Array.isArray(data) ? data : []
      if (selectedTarget && !peers.some(p => p.alias === selectedTarget)) selectedTarget = null
      renderPeers()
    })
  }

  let settingSwitch = false
  function refreshReceiverStatus() {
    execCapture(["systemctl", "--user", "is-active", "lsq-receive.service"], out => {
      const active = out.trim() === "active"
      subtitleLabel.set_label(active ? "RECEIVING" : "NOT RECEIVING")
      settingSwitch = true
      receiveSwitch.set_active(active)
      settingSwitch = false
    })
  }

  receiveSwitch.connect("state-set", (_sw, state) => {
    if (!settingSwitch) execShAsync(`systemctl --user ${state ? "start" : "stop"} lsq-receive.service`)
    return false
  })

  function sendPaths(paths) {
    if (!selectedTarget) {
      if (peers.length === 1) selectedTarget = peers[0].alias
      else { statusLabel.set_label("Pick a device first"); statusLabel.set_visible(true); return }
    }
    statusLabel.set_label(`Sending to ${selectedTarget}...`)
    statusLabel.set_visible(true)
    const quoted = paths.map(p => `'${p.replace(/'/g, `'\\''`)}'`).join(" ")
    execCapture(["bash", "-c", `lsq send --to '${selectedTarget}' --quiet ${quoted} 2>&1`], out => {
      statusLabel.set_label(out.trim() || `Sent to ${selectedTarget}`)
    })
  }

  sendFilesBtn.connect("clicked", () => {
    execCapture(["zenity", "--file-selection", "--multiple", "--separator=\n", "--title=Send via LocalSend"], out => {
      const paths = out.trim().split("\n").filter(Boolean)
      if (paths.length) sendPaths(paths)
    })
  })

  sendFolderBtn.connect("clicked", () => {
    execCapture(["zenity", "--file-selection", "--directory", "--title=Send folder via LocalSend"], out => {
      const path = out.trim()
      if (path) sendPaths([path])
    })
  })

  sendClipboardBtn.connect("clicked", () => {
    execCapture(["wl-paste"], out => {
      if (!out) { statusLabel.set_label("Clipboard is empty"); statusLabel.set_visible(true); return }
      const tmpPath = `/tmp/localsend-clipboard-${Date.now()}.txt`
      const file = Gio.File.new_for_path(tmpPath)
      file.replace_contents(new TextEncoder().encode(out), null, false, Gio.FileCreateFlags.NONE, null)
      sendPaths([tmpPath])
    })
  })

  const win = new Astal.Window({
    application: app,
    name: "localsend-popup",
    namespace: "localsend-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })
  win.set_child(root)

  win.connect("notify::visible", () => {
    if (!win.visible) return
    selectedTarget = null
    peers = []
    statusLabel.set_visible(false)
    renderPeers()
    execCapture(["lsq", "info"], out => {
      const m = out.match(/alias:\s*(.+?)\s*\(lsq\)/)
      aliasValue.set_label(m ? m[1] : "--")
    })
    refreshReceiverStatus()
    refreshPeers()
  })

  return win
}
