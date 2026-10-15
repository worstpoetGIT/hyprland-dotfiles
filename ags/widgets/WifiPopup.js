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

// Escapes a value for embedding in a WIFI: QR payload field, per the
// de-facto WIFI-QR spec (backslash, semicolon, comma, colon and quote are
// field/record separators and must be backslash-escaped).
function escapeQR(s) {
  return String(s).replace(/([\\;,:"])/g, "\\$1")
}

const STATUS_WORDS = {
  wifi: [
    "HANDLING PACKETS", "ROUTING TRAFFIC", "PINGING GATEWAY", "SYNCING DNS",
    "MODULATING SIGNAL", "MONITORING SNR", "BUFFERING FRAMES",
    "ARBITRATING CHANNEL", "BEACONING SSID", "NEGOTIATING MTU",
  ],
  ethernet: [
    "HANDLING PACKETS", "ROUTING TRAFFIC", "PINGING GATEWAY", "SYNCING DNS",
    "NEGOTIATING SPEED", "MONITORING LINK", "BUFFERING FRAMES",
    "CHECKING DUPLEX", "ARBITRATING MDI-X",
  ],
  idle: [
    "IDLE", "SCANNING FOR NETWORKS", "SEARCHING SIGNAL", "STANDING BY",
    "AWAITING LINK",
  ],
}

function StatRow(label, initial = "--") {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  box.append(new Gtk.Label({ css_classes: ["stat-label"], label, xalign: 0 }))
  const value = new Gtk.Label({ css_classes: ["stat-value"], label: initial, xalign: 0 })
  box.append(value)
  return { box, value }
}

// Same look as StatRow, but the whole cell is a button — click to copy the
// current value label to the clipboard, with a brief "✓ copied" flash.
function CopyableStatRow(label, initial = "--") {
  const inner = StatRow(label, initial)
  const btn = new Gtk.Button({ css_classes: ["stat-row-btn"], hexpand: true })
  btn.set_child(inner.box)
  btn.connect("clicked", () => {
    const text = inner.value.get_label()
    if (!text || text === "--") return
    execShAsync(`wl-copy '${text.replace(/'/g, "'\\''")}'`)
    inner.value.set_label(`${text}  ✓ copied`)
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
      inner.value.set_label(text)
      return GLib.SOURCE_REMOVE
    })
  })
  return { box: btn, value: inner.value }
}

export function WifiPopup() {
  let iface = ""
  let gateway = ""
  let activeConn = ""
  let connType = "idle"
  let statusWordIdx = 0
  let statusWordSource = null
  let pingHistory = []
  let baseRx = null
  let baseTx = null
  let lastRx = null
  let lastTx = null
  let lastSampleTime = null

  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 10, width_request: 420 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file("/home/worst_poet/.config/ags/icons/wifi.svg")
  headerIcon.set_pixel_size(22)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  const titleLabel = new Gtk.Label({ css_classes: ["popup-title"], label: "Not Connected", xalign: 0 })
  const subtitleLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "IDLE", xalign: 0 })
  headerText.append(titleLabel)
  headerText.append(subtitleLabel)
  const qrBtn = new Gtk.Button({ css_classes: ["dns-pill"], label: "SHARE QR", valign: Gtk.Align.CENTER, sensitive: false })
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  headerRow.append(qrBtn)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  // ── QR share (revealed under the header on demand) ──
  const qrRevealer = new Gtk.Revealer({ transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN })
  const qrBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, halign: Gtk.Align.CENTER, margin_top: 4, margin_bottom: 4 })
  const qrImage = new Gtk.Picture({ content_fit: Gtk.ContentFit.CONTAIN, width_request: 200, height_request: 200 })
  const qrCaption = new Gtk.Label({ css_classes: ["stat-label"], label: "", xalign: 0.5 })
  const qrStatus = new Gtk.Label({ css_classes: ["stat-label"], label: "", xalign: 0.5, visible: false })
  qrBox.append(qrImage)
  qrBox.append(qrCaption)
  qrBox.append(qrStatus)
  qrRevealer.set_child(qrBox)
  root.append(qrRevealer)

  function shareCurrentNetworkQr() {
    if (qrRevealer.get_reveal_child()) { qrRevealer.set_reveal_child(false); return }
    if (!activeConn || connType !== "wifi") return
    const ssid = titleLabel.get_label()
    qrStatus.set_visible(true); qrStatus.set_label("Generating…")
    qrImage.set_paintable(null); qrCaption.set_label("")
    qrRevealer.set_reveal_child(true)
    execCapture(["nmcli", "-s", "-g", "802-11-wireless-security.psk", "connection", "show", activeConn], (pskOut) => {
      const psk = pskOut.trim()
      execCapture(["nmcli", "-g", "802-11-wireless-security.key-mgmt", "connection", "show", activeConn], (kmOut) => {
        const km = kmOut.trim()
        const type = !km || km === "none" ? "nopass" : "WPA"
        let payload = `WIFI:T:${type};S:${escapeQR(ssid)};`
        if (type !== "nopass" && psk) payload += `P:${escapeQR(psk)};`
        payload += ";"
        const qrPath = "/tmp/ags-wifi-qr.png"
        execCapture(["qrencode", "-o", qrPath, "-s", "6", "-m", "2", payload], () => {
          qrStatus.set_visible(false)
          qrImage.set_filename(qrPath)
          qrCaption.set_label(ssid)
        })
      })
    })
  }
  qrBtn.connect("clicked", shareCurrentNetworkQr)

  // ── Stat grid ──
  const row1 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row2 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row3 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row4 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const ping = StatRow("PING")
  const loss = StatRow("PACKET LOSS")
  const rx = StatRow("RECEIVING")
  const tx = StatRow("SENDING")
  const down = StatRow("DOWNLOADED")
  const up = StatRow("UPLOADED")
  const ip = CopyableStatRow("IP ADDRESS")
  const gw = StatRow("GATEWAY")
  row1.append(ping.box); row1.append(loss.box)
  row2.append(rx.box); row2.append(tx.box)
  row3.append(down.box); row3.append(up.box)
  row4.append(ip.box); row4.append(gw.box)
  root.append(row1); root.append(row2); root.append(row3); root.append(row4)

  // ── Band / Automatic ──
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))
  const bandRow = new Gtk.Box({ spacing: 20 })
  const bandBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  bandBox.append(new Gtk.Label({ css_classes: ["stat-label"], label: "WI-FI BAND", xalign: 0 }))
  const bandValue = new Gtk.Label({ css_classes: ["stat-value"], label: "--", xalign: 0 })
  bandBox.append(bandValue)
  const autoBtn = new Gtk.Button({ css_classes: ["dns-pill"], label: "AUTOMATIC", valign: Gtk.Align.CENTER })
  bandRow.append(bandBox)
  bandRow.append(autoBtn)
  root.append(bandRow)

  // ── DNS provider pills ──
  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "DNS PROVIDER", xalign: 0 }))
  const dnsRow = new Gtk.Box({ spacing: 6, homogeneous: true })
  const dnsOptions = [
    { id: "dhcp",       label: "DHCP",       dns: null },
    { id: "cloudflare", label: "Cloudflare", dns: "1.1.1.1 1.0.0.1" },
    { id: "google",     label: "Google",     dns: "8.8.8.8 8.8.4.4" },
    { id: "custom",     label: "Custom",     dns: "custom" },
  ]
  const dnsButtons = {}
  dnsOptions.forEach(opt => {
    const btn = new Gtk.Button({ css_classes: ["dns-pill"], label: opt.label })
    dnsButtons[opt.id] = btn
    btn.connect("clicked", () => {
      if (!activeConn) return
      if (opt.id === "dhcp") {
        execShAsync(`nmcli connection modify "${activeConn}" ipv4.ignore-auto-dns no ipv4.dns "" && nmcli connection up "${activeConn}"`)
      } else if (opt.id === "custom") {
        customEntry.set_visible(!customEntry.get_visible())
        return
      } else {
        execShAsync(`nmcli connection modify "${activeConn}" ipv4.ignore-auto-dns yes ipv4.dns "${opt.dns}" && nmcli connection up "${activeConn}"`)
      }
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => { refreshDnsState(); return GLib.SOURCE_REMOVE })
    })
    dnsRow.append(btn)
  })
  root.append(dnsRow)

  const customEntry = new Gtk.Entry({ css_classes: ["net-password-entry"], placeholder_text: "Custom DNS (space separated)", visible: false })
  customEntry.connect("activate", () => {
    const val = customEntry.get_text().trim()
    if (!activeConn || !val) return
    execShAsync(`nmcli connection modify "${activeConn}" ipv4.ignore-auto-dns yes ipv4.dns "${val}" && nmcli connection up "${activeConn}"`)
    customEntry.set_visible(false)
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => { refreshDnsState(); return GLib.SOURCE_REMOVE })
  })
  root.append(customEntry)

  function refreshDnsState() {
    if (!activeConn) return
    const ignoreAuto = exec(`nmcli -g ipv4.ignore-auto-dns connection show "${activeConn}"`)
    const dns = exec(`nmcli -g ipv4.dns connection show "${activeConn}"`)
    Object.values(dnsButtons).forEach(b => b.remove_css_class("active"))
    if (ignoreAuto !== "yes") { dnsButtons.dhcp.add_css_class("active"); return }
    if (dns.includes("1.1.1.1")) dnsButtons.cloudflare.add_css_class("active")
    else if (dns.includes("8.8.8.8")) dnsButtons.google.add_css_class("active")
    else if (dns) dnsButtons.custom.add_css_class("active")
  }

  // ── Known / other networks ──
  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "KNOWN NETWORKS", xalign: 0 }))
  const knownList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  root.append(knownList)

  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "AVAILABLE NETWORKS", xalign: 0 }))
  const otherList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  const otherScroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    max_content_height: 220,
    propagate_natural_height: true,
  })
  otherScroll.set_child(otherList)
  root.append(otherScroll)

  const pwRow = new Gtk.Box({ spacing: 6, visible: false })
  const pwEntry = new Gtk.Entry({ css_classes: ["net-password-entry"], placeholder_text: "Password", hexpand: true })
  pwEntry.set_visibility(false)
  const pwConnectBtn = new Gtk.Button({ css_classes: ["dns-pill"], label: "Connect" })
  pwRow.append(pwEntry); pwRow.append(pwConnectBtn)
  root.append(pwRow)
  let pendingSsid = null
  function connectWithPassword() {
    const pw = pwEntry.get_text()
    if (!pendingSsid || !pw) return
    execShAsync(`nmcli dev wifi connect "${pendingSsid}" password "${pw}"`)
    pwRow.set_visible(false)
    pwEntry.set_text("")
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => { refreshNetworks(); return GLib.SOURCE_REMOVE })
  }
  pwConnectBtn.connect("clicked", connectWithPassword)
  pwEntry.connect("activate", connectWithPassword)

  function networkRow(ssid, signal, active) {
    const btn = new Gtk.Button({ css_classes: ["net-row"] })
    const inner = new Gtk.Box({ spacing: 8 })
    const label = new Gtk.Label({ css_classes: active ? ["net-row-ssid", "net-row-active"] : ["net-row-ssid"], label: ssid + (active ? "  •  Connected" : ""), xalign: 0, hexpand: true })
    const sig = new Gtk.Label({ css_classes: ["net-row-lock"], label: signal + "%", xalign: 1 })
    inner.append(label); inner.append(sig)
    btn.set_child(inner)
    return btn
  }

  function refreshNetworks() {
    // --rescan no: use NetworkManager's cached scan instead of blocking on a
    // fresh one (a live Wi-Fi scan can take several seconds and freezes the
    // whole popup open, since this runs synchronously on the GTK main loop).
    const scan = exec("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list --rescan no")
    execShAsync("nmcli dev wifi rescan")
    const savedRaw = exec("nmcli -t -f NAME connection show")
    const saved = new Set(savedRaw.split("\n").map(s => s.trim()).filter(Boolean))

    let child = knownList.get_first_child()
    while (child) { const next = child.get_next_sibling(); knownList.remove(child); child = next }
    child = otherList.get_first_child()
    while (child) { const next = child.get_next_sibling(); otherList.remove(child); child = next }

    const seen = new Set()
    scan.split("\n").forEach(line => {
      const parts = line.split(":")
      if (parts.length < 4 || !parts[0]) return
      const [ssid, signal, security, active] = parts
      if (seen.has(ssid)) return
      seen.add(ssid)
      const isActive = active === "yes"
      const isKnown = saved.has(ssid)

      function connectRow() {
        if (isActive) return
        if (isKnown) {
          execShAsync(`nmcli connection up "${ssid}"`)
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => { refreshNetworks(); refreshHeader(); return GLib.SOURCE_REMOVE })
        } else if (security && security !== "--") {
          pendingSsid = ssid
          pwRow.set_visible(true)
          pwEntry.grab_focus()
        } else {
          execShAsync(`nmcli dev wifi connect "${ssid}"`)
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => { refreshNetworks(); refreshHeader(); return GLib.SOURCE_REMOVE })
        }
      }

      // KNOWN NETWORKS: saved connections only.
      if (isKnown) {
        const knownBtn = networkRow(ssid, signal, isActive)
        knownBtn.connect("clicked", connectRow)
        knownList.append(knownBtn)
      }

      // AVAILABLE NETWORKS: every scanned network, known or not, scrollable.
      const availBtn = networkRow(ssid, signal, isActive)
      availBtn.connect("clicked", connectRow)
      otherList.append(availBtn)
    })
  }

  function refreshHeader() {
    iface = exec(`nmcli -t -f DEVICE,TYPE dev status`).split("\n").map(l => l.split(":")).find(p => p[1] === "wifi")?.[0] || ""
    const ssid = exec("nmcli -t -f active,ssid dev wifi list --rescan no").split("\n").find(l => l.startsWith("yes:"))?.split(":")[1] || ""
    const ethDev = exec("nmcli -t -f TYPE,DEVICE,STATE dev").split("\n").find(l => l.startsWith("ethernet:") && l.includes(":connected"))
    if (ssid) {
      titleLabel.set_label(ssid)
      connType = "wifi"
    } else if (ethDev) {
      titleLabel.set_label(ethDev.split(":")[1] || "Wired")
      iface = ethDev.split(":")[1] || iface
      connType = "ethernet"
    } else {
      titleLabel.set_label("Not Connected")
      connType = "idle"
    }
    qrBtn.set_sensitive(connType === "wifi")
    gateway = exec("ip route show default").split(" ")[2] || "1.1.1.1"
    activeConn = iface ? exec(`nmcli -t -f NAME,DEVICE connection show --active`).split("\n").map(l => l.split(":")).find(p => p[1] === iface)?.[0] || "" : ""
    ip.value.set_label(iface ? (exec(`nmcli -g IP4.ADDRESS dev show ${iface}`).split("/")[0] || "--") : "--")
    gw.value.set_label(gateway || "--")
    if (iface) {
      const linkInfo = exec(`iw dev ${iface} link`)
      const freqMatch = linkInfo.match(/(\d{4,5}) MHz/)
      if (freqMatch) {
        const freq = parseInt(freqMatch[1])
        bandValue.set_label(freq < 3000 ? "2.4 GHZ" : "5 GHZ")
      } else {
        bandValue.set_label("--")
      }
    } else {
      bandValue.set_label("--")
    }
    refreshDnsState()
  }

  function samplePing() {
    if (!gateway) return
    execCapture(["ping", "-c", "1", "-W", "1", gateway], (out) => {
      const m = out.match(/time[=<]([\d.]+)/)
      const hit = !!m
      pingHistory.push(hit)
      if (pingHistory.length > 20) pingHistory.shift()
      const lossPct = pingHistory.length ? Math.round(100 * (1 - pingHistory.filter(Boolean).length / pingHistory.length)) : 0
      ping.value.set_label(hit ? `${m[1]} ms` : "timeout")
      loss.value.set_label(`${lossPct}%`)
    })
  }

  function sampleThroughput() {
    if (!iface) return
    try {
      const rxPath = `/sys/class/net/${iface}/statistics/rx_bytes`
      const txPath = `/sys/class/net/${iface}/statistics/tx_bytes`
      const [okRx, rxContent] = GLib.file_get_contents(rxPath)
      const [okTx, txContent] = GLib.file_get_contents(txPath)
      if (!okRx || !okTx) return
      const curRx = parseInt(new TextDecoder().decode(rxContent).trim())
      const curTx = parseInt(new TextDecoder().decode(txContent).trim())
      const now = GLib.get_monotonic_time() / 1e6
      if (baseRx === null) { baseRx = curRx; baseTx = curTx; lastRx = curRx; lastTx = curTx; lastSampleTime = now; return }
      const dt = Math.max(now - lastSampleTime, 0.5)
      const rxRate = (curRx - lastRx) / dt
      const txRate = (curTx - lastTx) / dt
      rx.value.set_label(fmtRate(rxRate))
      tx.value.set_label(fmtRate(txRate))
      down.value.set_label(fmtBytes(curRx - baseRx))
      up.value.set_label(fmtBytes(curTx - baseTx))
      lastRx = curRx; lastTx = curTx; lastSampleTime = now
    } catch (e) {}
  }

  function fmtBytes(b) {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  function fmtRate(bps) {
    if (bps < 1024) return `${bps.toFixed(0)} B/s`
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
    return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
  }

  let pollSource = null
  const win = new Astal.Window({
    application: app,
    name: "wifi-popup",
    namespace: "wifi-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    keymode: Astal.Keymode.ON_DEMAND,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })
  win.set_child(root)

  win.connect("notify::visible", () => {
    if (win.visible) {
      baseRx = null; baseTx = null; pingHistory = []; statusWordIdx = 0
      qrRevealer.set_reveal_child(false)
      refreshHeader()
      refreshNetworks()
      samplePing()
      sampleThroughput()
      if (!pollSource) {
        pollSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
          if (!win.visible) { pollSource = null; return GLib.SOURCE_REMOVE }
          samplePing()
          sampleThroughput()
          return GLib.SOURCE_CONTINUE
        })
      }
      if (!statusWordSource) {
        statusWordSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
          if (!win.visible) { statusWordSource = null; return GLib.SOURCE_REMOVE }
          const words = STATUS_WORDS[connType] || STATUS_WORDS.idle
          subtitleLabel.set_label(words[statusWordIdx % words.length])
          statusWordIdx++
          return GLib.SOURCE_CONTINUE
        })
      }
    }
  })

  return win
}
