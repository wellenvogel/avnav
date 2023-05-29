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
import re

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk,Gdk,GdkPixbuf,Gio,GObject,GLib,GdkX11

TITLE_CHECK=re.compile('AVNav-Web')

SIZE=48
MARGIN=SIZE+12
BASE_DIR="/usr/lib/avnav/viewer/images"

def getImage(name,baseDir=None):
    if baseDir is None:
        baseDir=BASE_DIR
    imgpath=os.path.join(baseDir,name)
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
        self.iconBase=None
    def run(self,*args):
        if self.command is None:
            return
        self.command(self.action)
    def getImage(self,baseDir=None):
        if baseDir is None:
            baseDir=self.iconBase
        return getImage(self.icon,baseDir)    

BUTTONS=[
    BDef(['Escape','ctrl+w'],'ic_clear.svg'), #close
    BDef('ctrl+bracketleft','ic_arrow_back.svg'), #back
    BDef('F5','ic_refresh.svg') #reload
]

class ButtonList():
    def __init__(self,callback,buttons=BUTTONS,iconBase=None) -> None:
        self.buttons=buttons
        self.callback=callback
        for button in self.buttons:
            if iconBase is not  None:
                button.iconBase=iconBase
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

def getProp(disp,win, prop):
    if disp is None:
        disp=Display()
    p = win.get_full_property(disp.intern_atom('_NET_WM_' + prop), 0)
    return [None] if (p is None) else p.value
def listWindows(root):
    children = root.query_tree().children
    for window in children:
        yield window
    for window in children:
        for window in listWindows(window):
            yield window

def findWindowByPid(pid):
    disp = Display()
    xroot = disp.screen().root
    for window in listWindows(xroot):
        attrs=window.get_attributes()
        if attrs is None or attrs.map_state != Xlib.X.IsViewable:
            continue
        PIDs=getProp(disp,window,'PID')
        if PIDs is None or len(PIDs) < 1:
            continue
        if PIDs[0] != pid:
            continue
        name=window.get_wm_name()
        window.change_attributes(event_mask=Xlib.X.PropertyChangeMask)
        return window

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
        self.add_main_option(
            'base',
            ord('b'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.STRING,
            'base dir for icons',
            None
        )
        self.window = None
        self.targetPid=None
        self.targetWindow=None
        self.buttonlist=None
        self.iconBase=None
    def do_command_line(self, command_line):
        options = command_line.get_options_dict()
        # convert GVariantDict -> GVariant -> dict
        options = options.end().unpack()
        if 'class' in options:
            Gdk.set_program_class(options['class'])
        if 'pid' in options:
            self.targetPid=options['pid']
        if 'base' in options:
            self.iconBase=options['base']
        self.buttonlist=ButtonList(self.send_key,iconBase=self.iconBase)    
        self.activate()
    def eventHandler(self,ev):
        if self.targetWindow is not None:
            try:
                w=ev.get_window()
                xid=w.get_xid() if w is not None else None
                if xid == self.targetWindow.id:
                    print("evhandler", ev.get_event_type(),xid)
                    if ev.get_event_type() == Gdk.EventType.PROPERTY_NOTIFY:
                        print("property notify...")
                        if ev.property.atom.name()=='_NET_WM_NAME':
                            self.handleTargetVisibility()
            except Exception as e:
                print("ERR:",e)
        Gtk.main_do_event(ev)    
    def do_activate(self):
        if self.window is None:
            self.window = ButtonWindow(self.buttonlist)
            self.window.setPanelParam()
            self.window.connect("destroy", self.quit)
        self.window.show_all()
        self.window.setPosition()
        self.window.setStruts()
        self.add_window(self.window)
        Gdk.event_handler_set(self.eventHandler)
        if self.targetPid is not None:
            if self.findTarget:
                GLib.timeout_add(5000,self.findTarget)
            
    def findTarget(self):
        targetWindow=findWindowByPid(self.targetPid)
        if targetWindow is not None:
            self.targetWindow=targetWindow
            d=self.window.get_screen().get_display()
            tw=GdkX11.X11Window.foreign_new_for_display(d,self.targetWindow.id)
            tw.set_events(Gdk.EventMask.PROPERTY_CHANGE_MASK)
            self.handleTargetVisibility()
            return False
        return True
    def handleTargetVisibility(self):
        if self.targetWindow is None:
            self.window.show()
            self.window.setPosition()
            self.window.setStruts()
            return True
        name=getProp(None,self.targetWindow,'NAME')
        if TITLE_CHECK.match(name.decode('utf-8',errors='ignore')):
            self.window.hide()
            return False
        else:
            self.window.show()
            self.window.setPosition()
            self.window.setStruts()
            return True

    def send_key(self,key):
        if self.targetWindow is None:
            return
        if not isinstance(key,list):
            key=[key]
        cmd=["xdotool","windowactivate","--sync",str(self.targetWindow.id),"key"]
        cmd.extend(key)    
        res=subprocess.run(cmd)
        if res.returncode != 0:
            print("%s failed with %d"%(" ".join(cmd),res.returncode))
    
        


try:
    app=MyApp()
    app.run(sys.argv)
except:
    print(traceback.format_exc())
    sys.exit(1)
print("run finished...")