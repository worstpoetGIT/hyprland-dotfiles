import app from "ags/gtk4/app"
import GLib from "gi://GLib?version=2.0"
import { WifiPopup } from "./widgets/WifiPopup.js"
import { BluetoothPopup } from "./widgets/BluetoothPopup.js"
import { AudioPopup } from "./widgets/AudioPopup.js"
import { DisplayPopup } from "./widgets/DisplayPopup.js"
import { BatteryPopup } from "./widgets/BatteryPopup.js"
import { VitalsPopup } from "./widgets/VitalsPopup.js"
import { ClaudeStatsPopup } from "./widgets/ClaudeStatsPopup.js"
import { TailscalePopup } from "./widgets/TailscalePopup.js"
import { LocalSendPopup } from "./widgets/LocalSendPopup.js"
import { SessionPopup } from "./widgets/SessionPopup.js"
import { CalendarPopup } from "./widgets/CalendarPopup.js"
import { AccentPopup } from "./widgets/AccentPopup.js"

let popups = []

app.start({
  css: GLib.get_home_dir() + "/.config/ags/style/main.css",
  requestHandler(args, res) {
    const cmd = args[0]
    if (cmd === "reload-css") {
      try {
        app.reset_css()
        app.apply_css(GLib.get_home_dir() + "/.config/ags/style/main.css", true)
      } catch (e) {}
      res("ok")
      return
    }
    res("unknown")
  },
  main() {
    popups = [
      WifiPopup(),
      BluetoothPopup(),
      AudioPopup(),
      DisplayPopup(),
      BatteryPopup(),
      VitalsPopup(),
      ClaudeStatsPopup(),
      TailscalePopup(),
      LocalSendPopup(),
      SessionPopup(),
      CalendarPopup(),
      AccentPopup(),
    ]

    // Mutually exclusive popups: opening any one of these closes every
    // other one that was left open, instead of letting them stack.
    popups.forEach(win => {
      win.connect("notify::visible", () => {
        if (!win.visible) return
        popups.forEach(other => {
          if (other !== win && other.visible) other.visible = false
        })
      })
    })
  },
})
