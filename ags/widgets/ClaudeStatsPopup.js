import { Astal, Gtk } from "ags/gtk4"
import Gio from "gi://Gio?version=2.0"
import app from "ags/gtk4/app"

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

// Session token counts / burn rate / model breakdown are local-log-derived
// (real numbers, ccusage over the Pi's Claude Code session logs). The 5h and
// 7-day percentages below come from a *different* endpoint that reads
// Claude Code's own cachedUsageUtilization (~/.claude.json) — that's fetched
// by the CLI from Anthropic's servers and reflects the real account-wide
// plan usage, the same number no matter which device you're on.
const USAGE_URL = "https://pidash.example.com/api/claude-usage"
const DAY_USAGE_URL = offset => `https://pidash.example.com/api/claude-usage/day?offset=${offset}`
const ACCOUNT_USAGE_URL = "https://pidash.example.com/api/claude-usage/account"

function fmtTokens(n) {
  if (n == null) return "--"
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return String(n)
}

function fmtPercentUsed(percentUsed) {
  if (percentUsed == null) return "--"
  return `${Math.round(percentUsed * 10) / 10}%`
}

function fmtResetsIn(minutes) {
  if (minutes == null) return "--"
  if (minutes <= 0) return "resetting…"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function StatRow(label, initial = "--") {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  box.append(new Gtk.Label({ css_classes: ["stat-label"], label, xalign: 0 }))
  const value = new Gtk.Label({ css_classes: ["stat-value"], label: initial, xalign: 0 })
  box.append(value)
  return { box, value }
}

function BarRow(label) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  const topRow = new Gtk.Box({ spacing: 8 })
  const lbl = new Gtk.Label({ css_classes: ["stat-label"], label, hexpand: true, xalign: 0, width_chars: 5 })
  const val = new Gtk.Label({ css_classes: ["stat-value"], label: "--", xalign: 1 })
  topRow.append(lbl); topRow.append(val)
  const bar = new Gtk.ProgressBar({ css_classes: ["popup-progress", "bar-thin"] })
  box.append(topRow)
  box.append(bar)
  return { box, lbl, val, bar }
}

// @primary (colors.css) — hand-picked to match pidash's charts.js SVG line
// charts (fill+stroke area chart, thin translucent gridlines, mono axis
// labels), redrawn here with cairo since GTK has no SVG line-chart widget.
const CHART_PRIMARY = [0.580, 0.804, 0.969]

function LineChart(points) {
  const area = new Gtk.DrawingArea({ content_height: 96, hexpand: true, vexpand: false })
  area.set_draw_func((_widget, cr, width, height) => {
    const padL = 30, padR = 8, padT = 18, padB = 16
    const innerW = width - padL - padR
    const innerH = height - padT - padB
    const vMax = Math.max(1, ...points.map(p => p.value))
    const x = i => points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW
    const y = v => padT + innerH - (v / vMax) * innerH
    const [r, g, b] = CHART_PRIMARY

    // gridlines at 0% / 50% / 100%
    cr.setLineWidth(1)
    cr.setSourceRGBA(1, 1, 1, 0.08)
    ;[0, 0.5, 1].forEach(f => {
      const yy = padT + innerH * (1 - f)
      cr.moveTo(padL, yy); cr.lineTo(width - padR, yy); cr.stroke()
    })

    // filled area under the line
    cr.moveTo(x(0), y(0))
    points.forEach((p, i) => cr.lineTo(x(i), y(p.value)))
    cr.lineTo(x(points.length - 1), y(0))
    cr.closePath()
    cr.setSourceRGBA(r, g, b, 0.16)
    cr.fill()

    // the line itself
    points.forEach((p, i) => { if (i === 0) cr.moveTo(x(i), y(p.value)); else cr.lineTo(x(i), y(p.value)) })
    cr.setSourceRGBA(r, g, b, 1)
    cr.setLineWidth(1.5)
    cr.setLineJoin(1) // round
    cr.stroke()

    // point dots + value labels
    cr.selectFontFace("monospace", 0, 0)
    cr.setFontSize(9)
    points.forEach((p, i) => {
      const px = x(i), py = y(p.value)
      cr.setSourceRGBA(r, g, b, 1)
      cr.arc(px, py, 2, 0, 2 * Math.PI)
      cr.fill()
      cr.setSourceRGBA(1, 1, 1, 0.75)
      const text = fmtTokens(p.value)
      const textW = text.length * 5.3
      const lx = Math.min(Math.max(px - textW / 2, padL), width - padR - textW)
      cr.moveTo(lx, Math.max(9, py - 7))
      cr.showText(text)
    })

    // x-axis time labels
    cr.setFontSize(8)
    cr.setSourceRGBA(1, 1, 1, 0.45)
    points.forEach((p, i) => {
      cr.moveTo(x(i) - p.xlabel.length * 2.4, height - 4)
      cr.showText(p.xlabel)
    })
  })
  return area
}

export function ClaudeStatsPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 12, width_request: 320 })

  // ── Header ──
  const headerRow = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER })
  // Same glyph, same font (BarIcons.ttf) as the waybar's #custom-claude
  // module — a Gtk.Image loading icons/claude.svg rendered as a barely
  // visible blob at this size, the font glyph doesn't.
  const headerIcon = new Gtk.Label({ css_classes: ["popup-header-icon", "popup-header-icon-glyph"], label: "" })
  const headerText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  headerText.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Claude Code", xalign: 0 }))
  headerText.append(new Gtk.Label({ css_classes: ["popup-subtitle"], label: "ACCOUNT · ALL DEVICES", xalign: 0 }))
  headerRow.append(headerIcon)
  headerRow.append(headerText)
  root.append(headerRow)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "ACTIVE SESSION", xalign: 0 }))
  const sessionRow = new Gtk.Box({ spacing: 20, homogeneous: true })
  const sessionTokens = StatRow("SESSION TOKENS")
  const burnRate = StatRow("BURN RATE")
  sessionRow.append(sessionTokens.box); sessionRow.append(burnRate.box)
  root.append(sessionRow)
  const fiveHourResetRow = StatRow("RESETS IN")
  root.append(fiveHourResetRow.box)

  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))
  root.append(new Gtk.Label({ css_classes: ["section-caption"], label: "ACCOUNT LIMITS", xalign: 0 }))
  const fiveHourBar = BarRow("5H")
  const sevenDayBar = BarRow("7 DAY")
  root.append(fiveHourBar.box)
  root.append(sevenDayBar.box)
  const accountFreshness = new Gtk.Label({ css_classes: ["stat-label"], label: "", xalign: 0 })
  root.append(accountFreshness)

  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))
  const dayHeaderRow = new Gtk.Box({ spacing: 4, valign: Gtk.Align.CENTER })
  dayHeaderRow.append(new Gtk.Label({ css_classes: ["section-caption"], label: "TOKENS USED", hexpand: true, xalign: 0 }))
  const prevDayBtn = new Gtk.Button({ css_classes: ["cal-nav-btn"], label: "‹" })
  const dayLabel = new Gtk.Label({ css_classes: ["stat-value"], label: "Today" })
  const nextDayBtn = new Gtk.Button({ css_classes: ["cal-nav-btn"], label: "›", sensitive: false })
  dayHeaderRow.append(prevDayBtn); dayHeaderRow.append(dayLabel); dayHeaderRow.append(nextDayBtn)
  root.append(dayHeaderRow)
  const dayBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.append(dayBox)

  let dayOffset = 0

  function fmtDayLabel(dateStr, offset) {
    if (offset === 0) return "Today"
    if (offset === 1) return "Yesterday"
    const d = new Date(dateStr + "T12:00:00")
    return `${WEEKDAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`
  }

  function refreshDay() {
    execCapture(["curl", "-s", "--max-time", "5", DAY_USAGE_URL(dayOffset)], out => {
      let data
      try { data = JSON.parse(out) } catch { return }

      dayLabel.set_label(fmtDayLabel(data.date, dayOffset))
      nextDayBtn.set_sensitive(dayOffset > 0)

      clear(dayBox)
      const buckets = data.buckets || []
      const xlabels = ["12A", "6A", "12P", "6P"]
      const points = buckets.map((b, i) => ({ value: b.total_tokens, xlabel: xlabels[i] || "" }))
      dayBox.append(LineChart(points))
    })
  }

  prevDayBtn.connect("clicked", () => { dayOffset += 1; refreshDay() })
  nextDayBtn.connect("clicked", () => { if (dayOffset > 0) { dayOffset -= 1; refreshDay() } })

  function clear(box) {
    let child = box.get_first_child()
    while (child) { const next = child.get_next_sibling(); box.remove(child); child = next }
  }

  function refresh() {
    execCapture(["curl", "-s", "--max-time", "5", USAGE_URL], out => {
      let data
      try { data = JSON.parse(out) } catch { return }

      if (data.session) {
        sessionTokens.value.set_label(fmtTokens(data.session.total_tokens))
        burnRate.value.set_label(data.session.tokens_per_minute != null ? `${fmtTokens(Math.round(data.session.tokens_per_minute))}/min` : "--")
      } else {
        sessionTokens.value.set_label("--")
        burnRate.value.set_label("no active block")
      }
    })
  }

  function refreshAccount() {
    execCapture(["curl", "-s", "--max-time", "5", ACCOUNT_USAGE_URL], out => {
      let data
      try { data = JSON.parse(out) } catch { return }

      if (!data.available) {
        fiveHourBar.val.set_label("--")
        sevenDayBar.val.set_label("--")
        fiveHourResetRow.value.set_label("--")
        accountFreshness.set_label("")
        return
      }

      const fh = data.five_hour, sd = data.seven_day
      fiveHourBar.val.set_label(fh.percent_used != null ? `${fmtPercentUsed(fh.percent_used)} used` : "--")
      fiveHourBar.bar.set_fraction((fh.percent_used || 0) / 100)
      fiveHourResetRow.value.set_label(fmtResetsIn(fh.resets_in_minutes))
      sevenDayBar.val.set_label(sd.percent_used != null ? `${fmtPercentUsed(sd.percent_used)} used` : "--")
      sevenDayBar.bar.set_fraction((sd.percent_used || 0) / 100)

      const ageMin = data.fetched_at_ms != null ? Math.round((Date.now() - data.fetched_at_ms) / 60000) : null
      const sourceLabel = data.source === "live" ? "live" : "cached"
      accountFreshness.set_label(ageMin != null ? `${sourceLabel} · checked ${ageMin < 1 ? "just now" : ageMin + "m ago"}` : "")
    })
  }

  const win = new Astal.Window({
    application: app,
    name: "claude-stats-popup",
    namespace: "claude-stats-popup",
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
    dayOffset = 0
    refresh()
    refreshDay()
    refreshAccount()
  })

  return win
}
