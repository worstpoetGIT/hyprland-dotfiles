import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import Gio from "gi://Gio?version=2.0"
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

function StatRow(label, initial = "--") {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  box.append(new Gtk.Label({ css_classes: ["stat-label"], label, xalign: 0 }))
  const value = new Gtk.Label({ css_classes: ["stat-value"], label: initial, xalign: 0 })
  box.append(value)
  return { box, value }
}

export function TailscalePopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 12, width_request: 320 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file(GLib.get_home_dir() + "/.config/ags/icons/tailscale.svg")
  headerIcon.set_pixel_size(20)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  headerText.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Tailscale", xalign: 0 }))
  const subtitleLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "--", xalign: 0 })
  headerText.append(subtitleLabel)
  const connSwitch = new Gtk.Switch({ css_classes: ["popup-switch"], valign: Gtk.Align.CENTER })
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  headerRow.append(connSwitch)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "THIS DEVICE", xalign: 0 }))
  const meRow = new Gtk.Box({ spacing: 20, homogeneous: true })
  const hostname = StatRow("HOSTNAME")
  const myIp = StatRow("TAILSCALE IP")
  meRow.append(hostname.box); meRow.append(myIp.box)
  root.append(meRow)

  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))
  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "DEVICES", xalign: 0 }))
  const peerList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  root.append(peerList)

  let settingConn = false
  let peers = []

  function renderPeers() {
    let child = peerList.get_first_child()
    while (child) { const next = child.get_next_sibling(); peerList.remove(child); child = next }
    peers.forEach(p => {
      const row = new Gtk.Box({ css_classes: ["net-row"], spacing: 8 })
      const dot = new Gtk.Label({ css_classes: [p.online ? "list-row-online" : "list-row-offline"], label: "●" })
      const label = new Gtk.Label({ css_classes: ["net-row-ssid"], label: p.hostname, xalign: 0, hexpand: true })
      const ip = new Gtk.Label({ css_classes: ["net-row-lock"], label: p.ip, xalign: 1 })
      row.append(dot); row.append(label); row.append(ip)
      peerList.append(row)
    })
  }

  function refresh() {
    execCapture(["tailscale", "status", "--json"], out => {
      let data
      try { data = JSON.parse(out) } catch { return }

      settingConn = true
      connSwitch.set_active(data.BackendState === "Running")
      settingConn = false

      const self = data.Self || {}
      hostname.value.set_label(self.HostName || "--")
      myIp.value.set_label((self.TailscaleIPs || []).find(ip => !ip.includes(":")) || "--")

      const peerMap = data.Peer || {}
      peers = Object.values(peerMap).map(p => {
        const dns = (p.DNSName || "").replace(/\.$/, "")
        const dnsShort = dns.split(".")[0] || ""
        // iOS nodes often report HostName "localhost" — fall back to the
        // DNS short name (e.g. "iphone15"), rendered as a proper "iPhone".
        let hostname = (p.HostName && p.HostName.toLowerCase() !== "localhost") ? p.HostName : (dnsShort || p.HostName)
        if (/^iphone/i.test(dnsShort)) hostname = "iPhone"
        return {
          hostname,
          dns,
          online: !!p.Online,
          ip: (p.TailscaleIPs || []).find(ip => !ip.includes(":")) || "",
        }
      }).sort((a, b) => (b.online - a.online) || a.hostname.localeCompare(b.hostname))

      const onlineCount = peers.filter(p => p.online).length
      subtitleLabel.set_label(`${onlineCount}/${peers.length} DEVICES ONLINE`)
      renderPeers()
    })
  }

  connSwitch.connect("state-set", (_sw, state) => {
    if (!settingConn) execShAsync(state ? "tailscale up" : "tailscale down")
    return false
  })

  const win = new Astal.Window({
    application: app,
    name: "tailscale-popup",
    namespace: "tailscale-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })
  win.set_child(root)

  win.connect("notify::visible", () => { if (win.visible) refresh() })

  return win
}
