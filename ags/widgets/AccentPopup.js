import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import Gio from "gi://Gio?version=2.0"
import app from "ags/gtk4/app"

const SCRIPT = GLib.get_home_dir() + "/.config/waybar/scripts/accent-dot.py"

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

// setsid: applying restarts AGS (matugen post_hook), which would otherwise
// take the spawned script down with it halfway through.
function execDetached(argv) {
  try {
    GLib.spawn_async(null, ["setsid", ...argv], null, GLib.SpawnFlags.SEARCH_PATH, null)
  } catch (e) {}
}

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
}

// One filled circle per color (primary / secondary / tertiary), drawn with
// cairo so each swatch can be an arbitrary hex without per-widget CSS.
function Swatch(hex, size = 18) {
  const area = new Gtk.DrawingArea({ width_request: size, height_request: size, valign: Gtk.Align.CENTER })
  const [r, g, b] = hexToRgb(hex)
  area.set_draw_func((_a, cr, w, h) => {
    cr.arc(w / 2, h / 2, Math.min(w, h) / 2 - 0.5, 0, 2 * Math.PI)
    cr.setSourceRGB(r, g, b)
    cr.fill()
  })
  return area
}

export function AccentPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 6, width_request: 300 })

  const header = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  header.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Accent color", xalign: 0 }))
  const subtitle = new Gtk.Label({ css_classes: ["popup-subtitle"], label: "FROM WALLPAPER", xalign: 0 })
  header.append(subtitle)
  root.append(header)
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  root.append(list)

  const win = new Astal.Window({
    application: app,
    name: "accent-popup",
    namespace: "accent-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })

  function render(data) {
    let child
    while ((child = list.get_first_child())) list.remove(child)

    if (!data || !data.colors || data.colors.length === 0) {
      list.append(new Gtk.Label({ css_classes: ["popup-subtitle"], label: "NO COLORS FOUND", xalign: 0 }))
      return
    }
    subtitle.label = data.wallpaper.toUpperCase()

    data.colors.forEach(c => {
      const row = new Gtk.Button({ css_classes: ["net-row"] })
      const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })

      const sw = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
      c.swatches.forEach(h => sw.append(Swatch(h)))
      box.append(sw)

      const label = new Gtk.Label({
        css_classes: c.selected ? ["net-row-ssid", "net-row-active"] : ["net-row-ssid"],
        label: c.name, xalign: 0, hexpand: true,
      })
      box.append(label)
      box.append(new Gtk.Label({ css_classes: ["net-row-lock"], label: c.selected ? "ACTIVE" : c.swatches[0] }))

      row.set_child(box)
      row.connect("clicked", () => {
        win.visible = false
        if (!c.selected) execDetached(["python3", "-I", SCRIPT, "select", String(c.index)])
      })
      list.append(row)
    })
  }

  function refresh() {
    execCapture(["python3", "-I", SCRIPT, "list"], out => {
      try { render(JSON.parse(out)) } catch (e) { render(null) }
    })
  }

  win.set_child(root)
  win.connect("notify::visible", () => { if (win.visible) refresh() })
  return win
}
