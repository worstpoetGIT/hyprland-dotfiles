#!/usr/bin/env python3
import subprocess
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
import os
import signal

class ControlPanel(Gtk.Window):
    def __init__(self):
        super().__init__()
        self.set_title("hypr-control")
        self.set_decorated(False)
        self.set_app_paintable(True)
        self.connect("destroy", Gtk.main_quit)
        self.connect("key-press-event", self.on_key_press)

        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            self.set_visual(visual)

        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        geometry = monitor.get_geometry()
        self.set_default_size(geometry.width, geometry.height)
        self.move(geometry.x, geometry.y)
        self.fullscreen()

        self.override_background_color(Gtk.StateFlags.NORMAL, Gdk.RGBA(0, 0, 0, 1))

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        main_box.set_halign(Gtk.Align.CENTER)
        main_box.set_valign(Gtk.Align.CENTER)

        css = b"""
        * { font-family: monospace; }
        .title-label {
            color: #ffffff;
            font-size: 13px;
            letter-spacing: 6px;
            opacity: 0.25;
            margin-bottom: 48px;
        }
        .action-btn {
            background: transparent;
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 2px;
            padding: 14px 32px;
            font-size: 13px;
            letter-spacing: 2px;
            min-width: 220px;
            transition: all 0.15s ease;
        }
        .action-btn:hover {
            background: rgba(255,255,255,0.06);
            border-color: rgba(255,255,255,0.35);
        }
        .action-btn:active {
            background: rgba(255,255,255,0.12);
        }
        .danger-btn {
            color: #ff4d4d;
            border-color: rgba(255,77,77,0.2);
        }
        .danger-btn:hover {
            background: rgba(255,77,77,0.08);
            border-color: rgba(255,77,77,0.5);
        }
        .hint-label {
            color: rgba(255,255,255,0.2);
            font-size: 11px;
            letter-spacing: 2px;
            margin-top: 56px;
        }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        title = Gtk.Label(label="SYSTEM CONTROL")
        title.get_style_context().add_class("title-label")
        main_box.pack_start(title, False, False, 0)

        buttons = [
            ("  LOCK", "lock", False),
            ("  SLEEP", "sleep", False),
            ("  REBOOT", "reboot", True),
            ("  SHUTDOWN", "shutdown", True),
        ]

        for label, action, is_danger in buttons:
            btn = Gtk.Button(label=label)
            btn.get_style_context().add_class("action-btn")
            if is_danger:
                btn.get_style_context().add_class("danger-btn")
            btn.connect("clicked", self.on_action, action)
            main_box.pack_start(btn, False, False, 6)

        hint = Gtk.Label(label="ESC TO DISMISS")
        hint.get_style_context().add_class("hint-label")
        main_box.pack_start(hint, False, False, 0)

        self.add(main_box)
        self.show_all()

    def on_key_press(self, widget, event):
        if event.keyval == Gdk.KEY_Escape:
            Gtk.main_quit()

    def on_action(self, button, action):
        Gtk.main_quit()
        if action == "lock":
            subprocess.Popen(["hyprlock"])
        elif action == "sleep":
            subprocess.Popen(["systemctl", "suspend"])
        elif action == "reboot":
            subprocess.Popen(["systemctl", "reboot"])
        elif action == "shutdown":
            subprocess.Popen(["systemctl", "poweroff"])

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    app = ControlPanel()
    Gtk.main()
