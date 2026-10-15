import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import app from "ags/gtk4/app"

function exec(cmd) {
  try {
    const [ok, out] = GLib.spawn_command_line_sync(cmd)
    return ok ? new TextDecoder().decode(out).trim() : ""
  } catch { return "" }
}

function execAsync(argv) {
  try {
    GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null)
  } catch (e) {}
}

function readSysfs(path) {
  try {
    const [ok, content] = GLib.file_get_contents(path)
    return ok ? new TextDecoder().decode(content).trim() : ""
  } catch { return "" }
}

// spawn_command_line_sync shell-splits its own argument (g_shell_parse_argv)
// but doesn't run a real shell — no pipes/globs. Wrapping as `bash -c
// <quoted>` gets a real shell for the inner command while still going
// through the same synchronous, no-callback path the rest of this file uses.
function execSh(cmd) {
  try {
    const [ok, out] = GLib.spawn_command_line_sync("bash -c " + GLib.shell_quote(cmd))
    return ok ? new TextDecoder().decode(out).trim() : ""
  } catch { return "" }
}

// UPower already keeps a rolling charge/discharge-rate history per battery
// at /var/lib/upower/history-rate-<model>-*.dat (plain text: "<epoch> <watts>
// <charging|discharging>"), sampled straight from BAT0's own state — so this
// is naturally blind to the USB-C port sourcing power out to charge a phone,
// since that never touches BAT0's charging state at all. Filename's matched
// by model_name prefix rather than hardcoded, since the trailing id segment
// isn't derivable from sysfs.
function lastChargedTimestamp() {
  const model = readSysfs("/sys/class/power_supply/BAT0/model_name")
  if (!model) return null
  const out = execSh(`awk -F'\t' '$3=="charging"{t=$1} END{if (t) print t}' /var/lib/upower/history-rate-${model}-*.dat 2>/dev/null`)
  const ts = parseInt(out)
  return Number.isFinite(ts) && ts > 0 ? ts : null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function fmtClock(d) {
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, "0")
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12; if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtLastCharged(ts) {
  if (!ts) return "--"
  const d = new Date(ts * 1000)
  const now = new Date()
  if (sameDay(d, now)) return `Today ${fmtClock(d)}`
  const yesterday = new Date(now.getTime() - 86400000)
  if (sameDay(d, yesterday)) return `Yesterday ${fmtClock(d)}`
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${fmtClock(d)}`
}

function StatRow(label, initial = "--") {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  box.append(new Gtk.Label({ css_classes: ["stat-label"], label, xalign: 0 }))
  const value = new Gtk.Label({ css_classes: ["stat-value"], label: initial, xalign: 0 })
  box.append(value)
  return { box, value }
}

// This laptop runs amd-pstate-epp, which only supports performance/powersave
// governors (no schedutil) — so profile switching goes through the ACPI
// platform_profile knob instead, which amd-pstate-epp respects properly.
// Fan level is tied to the same profile: 0-7 manual levels via thinkpad_acpi,
// "full-speed" is its dedicated peak-RPM override.
const PROFILES = [
  { id: "low-power",   label: "Power-saver", fanLevel: "2" },
  { id: "balanced",    label: "Balanced",    fanLevel: "4" },
  { id: "performance", label: "Performance", fanLevel: "full-speed" },
]

export function BatteryPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 12, width_request: 320 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  const headerIcon = new Gtk.Image({ css_classes: ["popup-header-icon"] })
  headerIcon.set_from_file(GLib.get_home_dir() + "/.config/ags/icons/battery.svg")
  headerIcon.set_pixel_size(20)
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  headerText.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Battery", xalign: 0 }))
  headerText.append(new Gtk.Label({ css_classes: ["popup-subtitle"], label: "THRESHOLD", xalign: 0 }))
  const pctLabel = new Gtk.Label({ css_classes: ["popup-big-value"], label: "--%", xalign: 1, valign: Gtk.Align.CENTER })
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  headerRow.append(pctLabel)
  root.append(headerRow)

  const progress = new Gtk.ProgressBar({ css_classes: ["popup-progress"] })
  root.append(progress)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  // ── Stat grid ──
  const row1 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row2 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const row3 = new Gtk.Box({ spacing: 20, homogeneous: true })
  const size = StatRow("BATTERY SIZE")
  const limit = StatRow("CHARGE LIMIT")
  const cycles = StatRow("CHARGE CYCLES")
  const health = StatRow("BATTERY HEALTH")
  const state = StatRow("BATTERY STATE")
  const timeRemaining = StatRow("TIME REMAINING")
  row1.append(size.box); row1.append(limit.box)
  row2.append(cycles.box); row2.append(health.box)
  row3.append(state.box); row3.append(timeRemaining.box)
  root.append(row1); root.append(row2); root.append(row3)

  const lastCharged = StatRow("LAST CHARGED")
  root.append(lastCharged.box)

  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "POWER PROFILE", xalign: 0 }))
  const profileRow = new Gtk.Box({ spacing: 6, homogeneous: true })
  const profileButtons = {}
  PROFILES.forEach(p => {
    const btn = new Gtk.Button({ css_classes: ["dns-pill"], label: p.label })
    profileButtons[p.id] = btn
    btn.connect("clicked", () => {
      execAsync(["bash", "-c", `echo ${p.id} | sudo tee /sys/firmware/acpi/platform_profile && echo "level ${p.fanLevel}" | sudo tee /proc/acpi/ibm/fan`])
      Object.values(profileButtons).forEach(b => b.remove_css_class("active"))
      btn.add_css_class("active")
    })
    profileRow.append(btn)
  })
  root.append(profileRow)

  function refresh() {
    const capacity = parseInt(readSysfs("/sys/class/power_supply/BAT0/capacity")) || 0
    const status = readSysfs("/sys/class/power_supply/BAT0/status") || "--"
    pctLabel.set_label(`${capacity}%`)
    progress.set_fraction(capacity / 100)

    const energyFullDesign = parseInt(readSysfs("/sys/class/power_supply/BAT0/energy_full_design"))
    size.value.set_label(energyFullDesign ? `${Math.round(energyFullDesign / 1e6)}Wh` : "--")

    const start = readSysfs("/sys/class/power_supply/BAT0/charge_control_start_threshold")
    const end = readSysfs("/sys/class/power_supply/BAT0/charge_control_end_threshold")
    limit.value.set_label(start && end ? `${start}-${end}%` : "--")

    const cycleCount = readSysfs("/sys/class/power_supply/BAT0/cycle_count")
    cycles.value.set_label(cycleCount || "--")

    // Same ratio UPower reports as "capacity" (its battery-health figure):
    // full-charge energy against the factory design capacity. Falls back to
    // the charge_* (µAh) attributes on batteries that expose those instead
    // of energy_* (µWh).
    const fullNow = parseFloat(readSysfs("/sys/class/power_supply/BAT0/energy_full")) ||
      parseFloat(readSysfs("/sys/class/power_supply/BAT0/charge_full"))
    const fullDesign = parseFloat(readSysfs("/sys/class/power_supply/BAT0/energy_full_design")) ||
      parseFloat(readSysfs("/sys/class/power_supply/BAT0/charge_full_design"))
    health.value.set_label(fullNow && fullDesign ? `${(fullNow / fullDesign * 100).toFixed(1)}%` : "--")

    let stateLabel = status
    if (status === "Not charging" && end && capacity >= parseInt(end) - 1) stateLabel = "Holding"
    state.value.set_label(stateLabel)

    let timeStr = "--"
    const upowerDev = exec("upower -e").split("\n").find(l => l.includes("BAT"))
    if (upowerDev) {
      const info = exec(`upower -i ${upowerDev}`)
      const m = info.match(/time to (empty|full):\s+(.+)/)
      if (m) timeStr = `${m[2].trim()} to ${m[1]}`
    }
    timeRemaining.value.set_label(timeStr)

    lastCharged.value.set_label(fmtLastCharged(lastChargedTimestamp()))

    const profile = readSysfs("/sys/firmware/acpi/platform_profile")
    Object.entries(profileButtons).forEach(([id, btn]) => {
      if (id === profile) btn.add_css_class("active"); else btn.remove_css_class("active")
    })
  }

  const win = new Astal.Window({
    application: app,
    name: "battery-popup",
    namespace: "battery-popup",
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
