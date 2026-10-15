import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import app from "ags/gtk4/app"

function exec(cmd) {
  try {
    const [ok, out] = GLib.spawn_command_line_sync(cmd)
    return ok ? new TextDecoder().decode(out).trim() : ""
  } catch { return "" }
}

function readSysfs(path) {
  try {
    const [ok, content] = GLib.file_get_contents(path)
    return ok ? new TextDecoder().decode(content).trim() : ""
  } catch { return "" }
}

function StatRow(label, initial = "--") {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  box.append(new Gtk.Label({ css_classes: ["stat-label"], label, xalign: 0 }))
  const value = new Gtk.Label({ css_classes: ["stat-value"], label: initial, xalign: 0 })
  box.append(value)
  return { box, value }
}

export function VitalsPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 10, width_request: 300 })
  root.append(new Gtk.Label({ css_classes: ["popup-title"], label: "System Vitals", xalign: 0 }))
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const row1 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row2 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row3 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const cpu = StatRow("CPU USAGE")
  const ram = StatRow("RAM")
  const temp = StatRow("TEMP")
  const disk = StatRow("DISK (/)")
  const fan = StatRow("FAN")
  row1.append(cpu.box); row1.append(ram.box)
  row2.append(temp.box); row2.append(disk.box)
  row3.append(fan.box); row3.append(new Gtk.Box({ hexpand: true }))
  root.append(row1); root.append(row2); root.append(row3)

  let prevIdle = null
  let prevTotal = null

  function sampleCpu() {
    const line = readSysfs("/proc/stat").split("\n")[0]
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    const idle = parts[3] + (parts[4] || 0)
    const total = parts.reduce((a, b) => a + b, 0)
    if (prevIdle !== null) {
      const dIdle = idle - prevIdle
      const dTotal = total - prevTotal
      const usage = dTotal > 0 ? Math.round(100 * (1 - dIdle / dTotal)) : 0
      cpu.value.set_label(`${usage}%`)
    }
    prevIdle = idle; prevTotal = total
  }

  function sampleRam() {
    const line = exec("free -m").split("\n")[1] || ""
    const parts = line.trim().split(/\s+/)
    const total = parts[1], used = parts[2]
    if (total) ram.value.set_label(`${used} / ${total} MB`)
  }

  function sampleTemp() {
    const out = exec("sensors")
    const m = out.match(/Tctl:\s+\+?([\d.]+)/)
    temp.value.set_label(m ? `${m[1]} °C` : "--")
  }

  function sampleDisk() {
    const line = exec("df -h /").split("\n")[1] || ""
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 5) disk.value.set_label(`${parts[2]} / ${parts[1]} (${parts[4]})`)
  }

  function sampleFan() {
    const out = readSysfs("/proc/acpi/ibm/fan")
    const m = out.match(/speed:\s*(\d+)/)
    fan.value.set_label(m ? `${m[1]} RPM` : "--")
  }

  function sampleAll() {
    sampleCpu(); sampleRam(); sampleTemp(); sampleDisk(); sampleFan()
  }

  let pollSource = null
  const win = new Astal.Window({
    application: app,
    name: "vitals-popup",
    namespace: "vitals-popup",
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
      prevIdle = null; prevTotal = null
      sampleAll()
      if (!pollSource) {
        pollSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
          if (!win.visible) { pollSource = null; return GLib.SOURCE_REMOVE }
          sampleAll()
          return GLib.SOURCE_CONTINUE
        })
      }
    }
  })

  return win
}
