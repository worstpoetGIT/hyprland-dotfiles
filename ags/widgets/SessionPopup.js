import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import app from "ags/gtk4/app"

function execShAsync(cmd) {
  try {
    GLib.spawn_async(null, ["bash", "-c", cmd], null, GLib.SpawnFlags.SEARCH_PATH, null)
  } catch (e) {}
}

// systemctl reboot/poweroff need interactive polkit auth that a
// background-spawned process can't provide — sudo (passwordless for this
// user) escalates straight to root instead, bypassing that entirely.
const ACTIONS = [
  { label: "Sleep",    cmd: "sudo systemctl suspend",  cls: "session-btn-sleep" },
  { label: "Reboot",   cmd: "sudo systemctl reboot",   cls: "session-btn-reboot" },
  { label: "Shutdown", cmd: "sudo systemctl poweroff", cls: "session-btn-shutdown" },
]

export function SessionPopup() {
  const root = new Gtk.Box({ css_classes: ["popup-card"], orientation: Gtk.Orientation.VERTICAL, spacing: 6, width_request: 220 })
  root.append(new Gtk.Label({ css_classes: ["popup-title"], label: "Session", xalign: 0 }))
  root.append(new Gtk.Separator({ css_classes: ["popup-divider"] }))

  const win = new Astal.Window({
    application: app,
    name: "session-popup",
    namespace: "session-popup",
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,
    visible: false,
    margin_top: 32,
    margin_right: 8,
  })

  ACTIONS.forEach(a => {
    const btn = new Gtk.Button({ css_classes: ["session-btn", a.cls], label: a.label })
    btn.connect("clicked", () => {
      win.visible = false
      execShAsync(a.cmd)
    })
    root.append(btn)
  })

  win.set_child(root)
  return win
}
