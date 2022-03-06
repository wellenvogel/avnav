#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
#  test_events.py
#
#  Copyright 2017 John Coppens <john*at*jcoppens*dot*com>
#
#  This program is free software; you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation; either version 2 of the License, or
#  (at your option) any later version.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with this program; if not, write to the Free Software
#  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
#  MA 02110-1301, USA.
#
#


from gi.repository import Gtk,Gdk




class MainWindow(Gtk.Window):
    def __init__(self):
        super(MainWindow, self).__init__()
        drawing=Gtk.DrawingArea()
        drawing.add_events(Gdk.EventMask.TOUCH_MASK)
        drawing.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        self.connect("destroy", lambda x: Gtk.main_quit())
        self.connect("event-after", self.on_event_after)
        drawing.connect("touch-event", self.on_touch_event)
        drawing.connect("button-press-event", self.on_button_pressed)
        drawing.set_double_buffered(False)
        self.set_default_size(300,400)
        self.add(drawing)
        self.show_all()
        print("Version:",Gtk._version)

    def on_button_pressed(self, btn, event):
        device=event.get_source_device()
        seat=device.get_seat()
        window=btn.get_window()
        print("button pressed",str(btn),str(device),str(seat))
        print("Capabilities=%s"%(seat.get_capabilities()))    
        return True
    def on_motion(self,wdg,event):
        print("motion event",event)
    def on_event_after(self, wdg, event):
        device=event.get_source_device()
        #print("Event after src=%s"%(device.get_source()),str(event))
    def on_touch_event(self, wdg, event):
        device=event.get_source_device()
        seat=device.get_seat()
        print("Event touch src=%s,seat=%s,window=%s"%(device.get_source(),seat,wdg.get_window()),str(event))
        print("Capabilities=%s"%(seat.get_capabilities()))    

    def run(self):
        Gtk.main()


def main(args):
    mainwdw = MainWindow()
    mainwdw.run()

    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main(sys.argv))

