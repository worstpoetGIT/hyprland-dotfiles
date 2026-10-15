import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import app from "ags/gtk4/app"

const POPUP_WIDTH = 300
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function exec(cmd) {
  try {
    const [ok, out] = GLib.spawn_command_line_sync(cmd)
    return ok ? new TextDecoder().decode(out).trim() : ""
  } catch { return "" }
}

// Logical (post-scale) monitor width, for computing a true center margin —
// GTK halign:CENTER doesn't reliably center content inside a layer-shell
// surface anchored LEFT+RIGHT, so this positions the popup explicitly instead.
function logicalMonitorWidth() {
  try {
    const out = exec("hyprctl monitors -j")
    const monitors = JSON.parse(out)
    const mon = monitors.find(m => m.focused) || monitors[0]
    return Math.round(mon.width / (mon.scale || 1))
  } catch {
    return 1536
  }
}

// Hand-built month grid, not Gtk.Calendar — GTK4's Calendar widget draws its
// day-grid mostly through internal (non-CSS-styleable) logic, which is why
// the per-date cell borders couldn't be removed via CSS. Plain labels in a
// Gtk.Grid give full styling control instead.
function MonthGrid() {
  const now = GLib.DateTime.new_now_local()
  let viewYear = now.get_year()
  let viewMonth = now.get_month() - 1 // 0-indexed to match JS Date conventions below

  const header = new Gtk.Box({ spacing: 8, valign: Gtk.Align.CENTER })
  const prevBtn = new Gtk.Button({ css_classes: ["cal-nav-btn"], label: "‹" })
  const monthLabel = new Gtk.Label({ css_classes: ["cal-month-label"], hexpand: true, xalign: 0.5 })
  const nextBtn = new Gtk.Button({ css_classes: ["cal-nav-btn"], label: "›" })
  header.append(prevBtn); header.append(monthLabel); header.append(nextBtn)

  const weekdayRow = new Gtk.Box({ spacing: 0, homogeneous: true })
  WEEKDAYS.forEach(w => weekdayRow.append(new Gtk.Label({ css_classes: ["cal-weekday"], label: w, hexpand: true })))

  const grid = new Gtk.Grid({ column_homogeneous: true, row_homogeneous: true, column_spacing: 2, row_spacing: 4 })

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  box.append(header)
  box.append(weekdayRow)
  box.append(grid)

  function render() {
    let c = grid.get_first_child()
    while (c) { const next = c.get_next_sibling(); grid.remove(c); c = next }

    const first = GLib.DateTime.new_local(viewYear, viewMonth + 1, 1, 0, 0, 0)
    monthLabel.set_label(first.format("%B %Y"))

    const isoWeekday = first.get_day_of_week() // 1=Monday..7=Sunday
    const startCol = isoWeekday === 7 ? 0 : isoWeekday // Sunday-first column index
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const today = GLib.DateTime.new_now_local()
    const isCurrentMonth = today.get_year() === viewYear && today.get_month() === viewMonth + 1

    let row = 0, col = startCol
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = isCurrentMonth && today.get_day_of_month() === d
      const lbl = new Gtk.Label({ css_classes: isToday ? ["cal-day", "cal-day-today"] : ["cal-day"], label: String(d) })
      grid.attach(lbl, col, row, 1, 1)
      col++
      if (col > 6) { col = 0; row++ }
    }
  }

  prevBtn.connect("clicked", () => {
    viewMonth--
    if (viewMonth < 0) { viewMonth = 11; viewYear-- }
    render()
  })
  nextBtn.connect("clicked", () => {
    viewMonth++
    if (viewMonth > 11) { viewMonth = 0; viewYear++ }
    render()
  })

  render()
  return box
}

export function CalendarPopup() {
  const card = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 10, width_request: POPUP_WIDTH })

  const dateLabel = new Gtk.Label({ css_classes: ["popup-subtitle"], xalign: 0.5 })
  function updateClock() {
    const now = GLib.DateTime.new_now_local()
    dateLabel.set_label(now.format("%A, %d %B %Y"))
  }
  updateClock()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { updateClock(); return GLib.SOURCE_CONTINUE })

  card.append(dateLabel)
  card.append(MonthGrid())

  const screenWidth = logicalMonitorWidth()
  const marginStart = Math.max(0, Math.round((screenWidth - POPUP_WIDTH) / 2))

  const win = new Astal.Window({
    application: app,
    name: "calendar-popup",
    namespace: "calendar-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_left: marginStart,
  })
  win.set_child(card)
  return win
}
