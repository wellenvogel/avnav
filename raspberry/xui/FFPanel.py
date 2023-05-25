#! /usr/bin/env python3

import gi
import os
import subprocess
import threading
import sys
import time
import traceback
import Xlib
from Xlib.display import Display
from Xlib import X

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk,Gdk,GdkPixbuf,Gio,GLib

SIZE=48
MARGIN=SIZE+12
BASE_DIR="/usr/lib/avnav/viewer/images"
def getImage(name):
    imgpath=os.path.join(BASE_DIR,name)
    if not os.path.exists(imgpath):
        raise Exception("image %s not found"%imgpath)
    pb=GdkPixbuf.Pixbuf.new_from_file_at_scale(imgpath,SIZE,SIZE,True)
    img=Gtk.Image()
    img.set_from_pixbuf(pb)
    return img


class BDef():
    def __init__(self,action,icon,command=None) -> None:
        self.action=action
        self.icon=icon
        self.command=command
    def run(self,*args):
        if self.command is None:
            return
        self.command(self.action)
    def getImage(self):
        return getImage(self.icon)    

BUTTONS=[
    BDef(['Escape','ctrl+w'],'ic_clear.svg'), #close
    BDef('ctrl+bracketleft','ic_arrow_back.svg'), #back
    BDef('F5','ic_refresh.svg') #reload
]

class ButtonList():
    def __init__(self,callback,buttons=BUTTONS) -> None:
        self.buttons=buttons
        self.callback=callback
        for button in self.buttons:
            if button.command is None:
                button.command=callback

class ButtonWindow(Gtk.Window):
    POS_RIGHT=0
    POS_LEFT=1
    def __init__(self,buttonList: ButtonList,lr:int=POS_RIGHT):
        super().__init__(title="FF-Panel")
        self.set_border_width(0)
        self.lr=lr
        self.curgeo=None

        hbox = Gtk.Box(spacing=6,orientation=Gtk.Orientation.VERTICAL)
        self.add(hbox)
        for bdef in buttonList.buttons:
            button = Gtk.Button()
            button.connect("clicked", bdef.run)
            button.set_image(bdef.getImage())
            hbox.pack_start(button, False, False, 0)

    def setPanelParam(self):
        self.set_decorated(False)
        self.set_role('Panel')
        self.set_type_hint(Gdk.WindowTypeHint.DOCK)
    

    def setPosition(self):
        display = self.get_screen().get_display()
        
        self.curgeo=display.get_monitor_at_window(self.get_window()).get_geometry()
        print("monitor %d x %d (offset x=%d, y=%d)" % (self.curgeo.width,
                                                                    self.curgeo.height,
                                                                    self.curgeo.x,
                                                                    self.curgeo.y))
        print("bar: right=%d" % (self.curgeo.x+self.curgeo.width-1))

        # display bar left/right
        if self.lr == self.POS_LEFT:
            self.move(self.curgeo.x,self.curgeo.y)
        else:
            #self.move(20,20)    
            #gravity does not work???
            self.move(self.curgeo.x+self.curgeo.width-MARGIN-1,self.curgeo.y)
        self.resize(SIZE,self.curgeo.height)
        
    #https://gist.github.com/johnlane/351adff97df196add08aGLib.OptionFlags.NONE
    def setStruts(self):
        if self.curgeo is None:
            raise Exception("curgeo not set")
        display = Display()
        topw = display.create_resource_object('window',
                                          self.get_window().get_xid())

        # http://python-xlib.sourceforge.net/doc/html/python-xlib_21.html#SEC20
        struts=None
        if self.lr == self.POS_LEFT:
            struts=[MARGIN, 0, 0, 0,   self.curgeo.y, self.curgeo.y+self.curgeo.height-1, 0, 0, 0, 0, 0, 0]
        else:
            struts=[0, MARGIN, 0, 0,   0, 0, self.curgeo.y, self.curgeo.y+self.curgeo.height-1, 0, 0, 0, 0]    
        res=topw.change_property(display.intern_atom('_NET_WM_STRUT_PARTIAL'),
                           display.intern_atom('CARDINAL'), 32,
                           struts,
                           X.PropModeReplace) 
        display.flush()

class MyApp(Gtk.Application):
    def __init__(self, *args, **kwargs):
        super().__init__(
            *args,
            flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
            **kwargs
        )
        self.add_main_option(
            'class',
            ord('c'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.STRING,
            "GTK application class",
            None
        )
        self.add_main_option(
            'pid',
            ord('p'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.INT,
            'Target pid to send keystrokes',
            None
        )
        self.window = None
        self.targetPid=None
        self.targetWindowId=None
        self.buttonlist=ButtonList(self.send_key)
    def do_command_line(self, command_line):
        options = command_line.get_options_dict()
        # convert GVariantDict -> GVariant -> dict
        options = options.end().unpack()
        if 'class' in options:
            Gdk.set_program_class(options['class'])
        if 'pid' in options:
            self.targetPid=options['pid']
        self.activate()
    def do_activate(self):
        if self.window is None:
            self.window = ButtonWindow(self.buttonlist)
            self.window.setPanelParam()
            self.window.connect("destroy", self.quit)
        self.window.show_all()
        self.window.setPosition()
        self.window.setStruts()
        self.add_window(self.window)
        if self.targetPid is not None:
            t=threading.Thread(target=self.findWindowId)
            t.start()

    def send_key(self,key):
        if self.targetWindowId is None:
            return
        if not isinstance(key,list):
            key=[key]
        cmd=["xdotool","windowactivate","--sync",str(self.targetWindowId),"key"]
        cmd.extend(key)    
        res=subprocess.run(cmd)
        if res.returncode != 0:
            print("%s failed with %d"%(" ".join(cmd),res.returncode))
    
    def findWindowId(self):
        if self.targetPid is None:
            print("no pid set...")
            return
        while self.targetWindowId is None:
            res=subprocess.run(["xdotool","search","--all","--onlyvisible","--pid",str(self.targetPid)],
                               capture_output=True,text=True,timeout=50)
            if res.returncode == 0:
                wid=res.stdout.rstrip().lstrip()
                if wid != "":
                    try:
                        self.targetWindowId=int(wid)
                        print("target window id %s found for pid %s"%(self.targetWindowId,self.targetPid))
                        return
                    except Exception as e: 
                        pass
            time.sleep(5)
        

try:
    app=MyApp()
    app.run(sys.argv)
except:
    print(traceback.format_exc())
    sys.exit(1)
print("run finished...")